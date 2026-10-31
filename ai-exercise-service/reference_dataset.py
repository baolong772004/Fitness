"""Build a criterion-level Squat comparison bank from verified development clips.

The bank supplies traceable examples, never an official verdict. Holdout clips
must remain outside it. A Coach's labels are human ground truth; a video's
presence in samples/ or a coarse 'good form' label is not ground truth.
"""
import argparse
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

from standard_registry import load_standard

ROOT = Path(__file__).resolve().parent
FEATURES = {
    'SQUAT-02': ('hipAboveKneeRatio',),
    'SQUAT-03': ('inwardChangeStanceRatio',),
    'SQUAT-04': ('earlyAscentLeanChangeDegrees', 'hipShoulderRiseDifferenceRatio'),
}
CAMERAS = {'SQUAT-02': 'SIDE', 'SQUAT-03': 'FRONT', 'SQUAT-04': 'SIDE'}


def _path(root, name):
    if not isinstance(name, str) or not name:
        raise ValueError('Missing reference artifact path')
    target = (root / name).resolve()
    if not target.is_relative_to(root):
        raise ValueError('Reference artifact escapes workspace')
    return target


def _digest(path):
    sha = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            sha.update(block)
    return sha.hexdigest()


def _number(value):
    return type(value) in (int, float) and math.isfinite(value)


def rep_features(inference, criterion_id, rep_number):
    """Return only comparable, evidence-backed measurements for one rep."""
    keys = FEATURES.get(criterion_id)
    if not keys:
        return None
    criterion = next((item for item in inference.get('techniqueEvaluation', {}).get('criteria', [])
                      if item.get('criterionId') == criterion_id), None)
    rows = [item for item in ((criterion or {}).get('measurement') or {}).get('perRep', [])
            if item.get('repNumber') == rep_number]
    if criterion_id == 'SQUAT-03' and len({row.get('side') for row in rows}) < 2:
        return None
    if not rows or any(not row.get('landmarkEvidence') or
                       not (row.get('measurementQuality') or {}).get('sufficientForExperimentalComparison')
                       for row in rows):
        return None
    values = []
    for key in keys:
        measured = [(row.get('observedValue') or {}).get(key) for row in rows]
        if any(not _number(value) for value in measured):
            return None
        values.append(max(measured) if criterion_id == 'SQUAT-03' else sum(measured) / len(measured))
    return [round(value, 6) for value in values]


def build_reference_bank(manifest_path, root=ROOT):
    root = Path(root).resolve()
    manifest = json.loads(_path(root, str(manifest_path)).read_text(encoding='utf-8'))
    clips = manifest.get('clips') if isinstance(manifest, dict) else manifest
    if not isinstance(clips, list):
        raise ValueError('Reference manifest must contain clips[]')
    standard = load_standard('SQUAT')
    allowed = {item['criterionId'] for item in standard['criteria']}
    entries, rejected, source_hashes, source_sessions, accepted_clips = [], [], set(), set(), set()
    for clip in clips:
        clip_id = clip.get('id', '<missing>') if isinstance(clip, dict) else '<invalid>'
        try:
            if not isinstance(clip, dict) or clip.get('split') != 'development' or clip.get('sourceType') != 'REAL':
                raise ValueError('REFERENCE_MUST_BE_REAL_DEVELOPMENT_VIDEO')
            if clip.get('exercise') != 'SQUAT' or clip.get('exerciseVariant') != 'BODYWEIGHT':
                raise ValueError('EXERCISE_OR_VARIANT_MISMATCH')
            if not clip.get('subjectId') or not clip.get('sessionId'):
                raise ValueError('SUBJECT_AND_SESSION_REQUIRED')
            video = _path(root, clip.get('path'))
            digest = _digest(video)
            if digest != clip.get('sha256'):
                raise ValueError('VIDEO_HASH_MISMATCH')
            session = (clip['subjectId'], clip['sessionId'])
            if digest in source_hashes or session in source_sessions:
                raise ValueError('DUPLICATE_VIDEO_OR_SESSION')
            labels = json.loads(_path(root, clip.get('coachLabels')).read_text(encoding='utf-8'))
            inference = json.loads(_path(root, clip.get('resultPath')).read_text(encoding='utf-8'))
            if (labels.get('schemaVersion') != 2 or labels.get('coachConfirmed') is not True or
                    labels.get('videoSha256') != digest or labels.get('sourceType') != 'REAL' or
                    not all(isinstance(labels.get(key), str) and labels[key].strip()
                            for key in ('reviewer', 'approvedConditions', 'reviewedAt'))):
                raise ValueError('COACH_CONFIRMATION_OR_VIDEO_BINDING_MISSING')
            if (labels.get('exercise') != 'SQUAT' or labels.get('exerciseVariant') != 'BODYWEIGHT' or
                    labels.get('rubricVersion') != standard['standardVersion'] or
                    inference.get('inputVideoSha256') != digest or
                    inference.get('techniqueEvaluation', {}).get('referenceStandardVersion') != standard['standardVersion']):
                raise ValueError('INFERENCE_OR_RUBRIC_MISMATCH')
            view = inference.get('cameraView', {}).get('detected')
            if view != labels.get('cameraView') or view not in ('FRONT', 'SIDE'):
                raise ValueError('CAMERA_VIEW_MISMATCH')
            if not inference.get('modelVersion') or not inference.get('ruleVersion'):
                raise ValueError('MODEL_OR_RULE_VERSION_MISSING')
            source_hashes.add(digest)
            source_sessions.add(session)
            accepted = 0
            seen_labels = set()
            repetitions = {item.get('number'): item for item in inference.get('repetitions', [])}
            for segment in labels.get('segments', []):
                rep = segment.get('repNumber')
                detected_rep = repetitions.get(rep)
                if type(rep) is not int or rep < 1 or not detected_rep:
                    continue
                for criterion_id, label in segment.get('criteria', {}).items():
                    if criterion_id not in allowed or criterion_id not in FEATURES or CAMERAS[criterion_id] != view:
                        continue
                    if label.get('outcome') not in ('MEETS', 'IMPROVE') or not str(label.get('note', '')).strip():
                        continue
                    if not label.get('reviewerId') or label.get('standardVersion') != standard['standardVersion']:
                        continue
                    key = (criterion_id, rep)
                    stamp = label.get('timestampSeconds')
                    if key in seen_labels or not _number(stamp):
                        continue
                    start, end = detected_rep.get('startSeconds'), detected_rep.get('endSeconds')
                    if not (_number(start) and _number(end) and start <= stamp <= end):
                        continue
                    vector = rep_features(inference, criterion_id, rep)
                    if vector is None:
                        continue
                    seen_labels.add(key)
                    entries.append({'criterionId': criterion_id, 'cameraView': view,
                                    'features': dict(zip(FEATURES[criterion_id], vector)),
                                    'outcome': label['outcome'], 'repNumber': rep,
                                    'timestampSeconds': stamp,
                                    'videoSha256': digest, 'subjectId': clip['subjectId'],
                                    'sessionId': clip['sessionId'], 'reviewerId': label['reviewerId'],
                                    'modelVersion': inference['modelVersion'],
                                    'ruleVersion': inference['ruleVersion'], 'source': clip_id})
                    accepted += 1
            if not accepted:
                rejected.append({'id': clip_id, 'reason': 'NO_QUALITY_GATED_CRITERION_LABELS'})
            else:
                accepted_clips.add(clip_id)
        except (OSError, ValueError, TypeError, KeyError, AttributeError) as error:
            rejected.append({'id': clip_id, 'reason': str(error)})
    groups = defaultdict(list)
    for item in entries:
        groups[(item['criterionId'], item['cameraView'], item['modelVersion'], item['ruleVersion'])].append(item)
    coverage = []
    for (criterion, view, model, rule), rows in sorted(groups.items()):
        counts = Counter(item['outcome'] for item in rows)
        subjects = {item['subjectId'] for item in rows}
        subjects_by_class = {status: len({item['subjectId'] for item in rows if item['outcome'] == status})
                             for status in ('MEETS', 'IMPROVE')}
        coverage.append({'criterionId': criterion, 'cameraView': view, 'modelVersion': model,
                         'ruleVersion': rule, 'meets': counts['MEETS'], 'improve': counts['IMPROVE'],
                         'subjects': len(subjects), 'subjectsByClass': subjects_by_class,
                         'comparisonReady': counts['MEETS'] >= 3 and counts['IMPROVE'] >= 3
                         and all(value >= 2 for value in subjects_by_class.values())})
    return {'schemaVersion': 1, 'purpose': 'DEVELOPMENT_REFERENCE_COMPARISON_ONLY',
            'standardVersion': standard['standardVersion'],
            'status': 'REFERENCE_COMPARISON_READY' if any(item['comparisonReady'] for item in coverage)
                      else 'BLOCKED_NO_COMPARABLE_COACH_LABELED_REFERENCES',
            'clipsSubmitted': len(clips), 'clipsWithAcceptedExamples': len(accepted_clips),
            'examples': entries, 'coverage': coverage, 'rejected': rejected,
            'officialVerdictsEnabled': False}


def compare_rep_to_bank(bank, inference, criterion_id, rep_number):
    """Compare features with labeled examples; this is never a pass/fail verdict."""
    identity = {'criterionId': criterion_id, 'repNumber': rep_number}
    if inference.get('inputVideoSha256') in {item['videoSha256'] for item in bank.get('examples', [])}:
        return {**identity, 'status': 'UNABLE_TO_COMPARE', 'reason': 'QUERY_VIDEO_IS_IN_REFERENCE_DATA'}
    query = rep_features(inference, criterion_id, rep_number)
    view = inference.get('cameraView', {}).get('detected')
    rows = [item for item in bank.get('examples', [])
            if item['criterionId'] == criterion_id and item['cameraView'] == view
            and item['modelVersion'] == inference.get('modelVersion')
            and item['ruleVersion'] == inference.get('ruleVersion')]
    if query is None:
        return {**identity, 'status': 'UNABLE_TO_COMPARE', 'reason': 'NO_QUALITY_GATED_QUERY_MEASUREMENT'}
    if not rows:
        return {**identity, 'status': 'UNABLE_TO_COMPARE', 'reason': 'NO_MATCHING_LABELED_REFERENCES'}
    coverage = next((item for item in bank.get('coverage', []) if item['criterionId'] == criterion_id
                     and item['cameraView'] == view and item['modelVersion'] == inference.get('modelVersion')
                     and item['ruleVersion'] == inference.get('ruleVersion')), None)
    if not coverage or not coverage['comparisonReady']:
        return {**identity, 'status': 'UNABLE_TO_COMPARE', 'reason': 'BOTH_LABELED_CLASSES_AND_SUBJECTS_REQUIRED',
                'coverage': coverage}
    keys = FEATURES[criterion_id]
    all_values = [[item['features'][key] for item in rows] for key in keys]
    scales = [max(max(values) - min(values), 1e-6) for values in all_values]
    ranked = sorted(rows, key=lambda item: sum(abs(query[index] - item['features'][key]) / scales[index]
                                                  for index, key in enumerate(keys)))
    return {'status': 'REFERENCE_COMPARISON_ONLY', 'criterionId': criterion_id, 'repNumber': rep_number,
            'features': dict(zip(keys, query)), 'nearestExamples': [
                {'outcome': item['outcome'], 'distance': round(sum(abs(query[index] - item['features'][key]) / scales[index]
                                                               for index, key in enumerate(keys)), 6),
                 'source': item['source'], 'videoSha256': item['videoSha256'], 'repNumber': item['repNumber']}
                for item in ranked[:3]], 'validatedForDecision': False}


def audit_local_catalog(catalog_path='evaluation/normalized-dataset-catalog.json', root=ROOT):
    """Inventory source footage without inventing criterion labels or split status."""
    root = Path(root).resolve()
    catalog = json.loads(_path(root, catalog_path).read_text(encoding='utf-8'))
    videos = []
    for item in catalog.get('normalizedLocalRecords', []):
        if item.get('exercise') != 'SQUAT' or item.get('variant') != 'BODYWEIGHT':
            continue
        path = _path(root, item.get('path'))
        exists = path.is_file()
        hash_matches = exists and _digest(path) == item.get('sha256')
        view = item.get('cameraView')
        videos.append({'videoId': item.get('videoId'), 'cameraViewDeclared': view,
                       'subjectId': item.get('subjectId'), 'split': item.get('split'),
                       'fileExists': exists, 'hashMatches': hash_matches,
                       'criterionLabels': len(item.get('criterionLabels') or []),
                       'cameraViewVerifiedByCurrentInference': False,
                       'candidateCriteriaIfViewConfirmed': [code for code, required in CAMERAS.items()
                                                            if required == view]})
    return {'bodyweightSquatVideos': len(videos),
            'verifiedFiles': sum(item['hashMatches'] for item in videos),
            'criterionLabeledVideos': sum(bool(item['criterionLabels']) for item in videos),
            'byDeclaredCamera': dict(Counter(item['cameraViewDeclared'] for item in videos)),
            'videos': videos}


def reference_comparison_for_inference(inference, bank_path='evaluation/private/reference-bank.json', root=ROOT):
    """Attach optional example similarity to an experimental result; never decide form."""
    if inference.get('evaluationMode') != 'EXPERIMENTAL':
        return {'status': 'EXPERIMENTAL_MODE_REQUIRED', 'validatedForDecision': False, 'repetitions': []}
    if inference.get('exercise') != 'SQUAT' or inference.get('exerciseVariant') != 'BODYWEIGHT':
        return {'status': 'NOT_APPLICABLE', 'validatedForDecision': False, 'repetitions': []}
    path = _path(Path(root).resolve(), bank_path)
    if not path.is_file():
        return {'status': 'REFERENCE_BANK_NOT_BUILT', 'validatedForDecision': False, 'repetitions': []}
    try:
        bank = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {'status': 'INVALID_REFERENCE_BANK', 'validatedForDecision': False, 'repetitions': []}
    if (bank.get('purpose') != 'DEVELOPMENT_REFERENCE_COMPARISON_ONLY' or
            bank.get('officialVerdictsEnabled') is not False or
            bank.get('standardVersion') != inference.get('referenceStandardVersion')):
        return {'status': 'REFERENCE_BANK_VERSION_OR_SCOPE_MISMATCH',
                'validatedForDecision': False, 'repetitions': []}
    comparisons = [compare_rep_to_bank(bank, inference, code, rep.get('number'))
                   for rep in inference.get('repetitions', []) for code in FEATURES]
    return {'status': bank.get('status'), 'validatedForDecision': False,
            'referenceExamples': len(bank.get('examples', [])), 'repetitions': comparisons}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', default='evaluation/reference-development-manifest.json')
    parser.add_argument('--output', default='evaluation/private/reference-bank.json')
    parser.add_argument('--query', help='Existing AI inference JSON to compare with the reference bank')
    parser.add_argument('--audit-catalog', action='store_true', help='Inventory existing Squat source videos')
    args = parser.parse_args()
    bank = build_reference_bank(args.manifest)
    destination = _path(ROOT, args.output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding='utf-8')
    report = {'status': bank['status'], 'clipsSubmitted': bank['clipsSubmitted'],
                      'examples': len(bank['examples']), 'coverage': bank['coverage'],
                      'rejected': bank['rejected']}
    if args.query:
        query = json.loads(_path(ROOT, args.query).read_text(encoding='utf-8'))
        if query.get('exercise') != 'SQUAT':
            raise ValueError('Query must be a Squat inference result')
        report['queryVideoSha256'] = query.get('inputVideoSha256')
        report['comparison'] = [compare_rep_to_bank(bank, query, criterion_id, rep.get('number'))
                                for rep in query.get('repetitions', [])
                                for criterion_id in FEATURES]
    if args.audit_catalog:
        report['datasetAudit'] = audit_local_catalog()
    print(json.dumps(report, ensure_ascii=False, indent=2))
