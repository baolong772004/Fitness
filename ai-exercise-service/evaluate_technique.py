"""Evaluate real Coach labels against an explicitly bound inference artifact.

Labels, exercise identity, camera view and reviewer expertise require human
review. Hashes and declarations are reproducibility checks, not proof that a
person is a qualified Coach or that a split is independent.
"""
import argparse
import hashlib
import json
import math
from copy import deepcopy
from collections import defaultdict
from pathlib import Path

from exercise_catalog import EXERCISES

ROOT = Path(__file__).resolve().parent
COUNT_KEYS = ('tp', 'fp', 'fn', 'tn', 'abstained', 'coachUnassessable',
              'falseAcceptance', 'unmatchedPredictions', 'assessableLabels')
DECISIVE = {'PASS': 'MEETS_CRITERION', 'MEETS_CRITERION': 'MEETS_CRITERION',
            'NEEDS_IMPROVEMENT': 'NEEDS_IMPROVEMENT'}


def _counts():
    return {key: 0 for key in COUNT_KEYS}


def _finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def _path(value, root=None):
    root = Path(root or ROOT).resolve()
    if not isinstance(value, str) or not value.strip():
        raise ValueError('A nonempty explicit file path is required')
    path = (root / value).resolve()
    if not path.is_relative_to(root):
        raise ValueError('Manifest file path must stay within the evaluation workspace')
    return path


def _criterion_ids(item):
    if item['exercise'] not in EXERCISES:
        raise ValueError('Unsupported labeled exercise')
    ids = item.get('criterionIds')
    if ids is None:
        return {criterion['code'] for criterion in EXERCISES[item['exercise']]['criteria']}
    # A standard-specific criterion list cannot silently redefine a rubric.
    if not item.get('referenceStandardVersion') or not isinstance(ids, list) or not ids:
        raise ValueError('Explicit criterionIds require an exact referenceStandardVersion')
    if any(not isinstance(code, str) or not code.strip() for code in ids) or len(set(ids)) != len(ids):
        raise ValueError('Invalid or duplicate manifest criterion IDs')
    return set(ids)


def checked_labels(item, labels, root=None):
    exercise = item['exercise']
    if item.get('sourceType') != 'REAL' or item.get('split') != 'holdout':
        raise ValueError('Accuracy requires REAL holdout footage')
    video = _path(item.get('path'), root)
    digest = hashlib.sha256(video.read_bytes()).hexdigest()
    if digest != item.get('sha256') or labels.get('videoSha256') != digest:
        raise ValueError('Video/label hash mismatch')
    if labels.get('schemaVersion') != 2 or labels.get('exercise') != exercise or labels.get('sourceType') != 'REAL':
        raise ValueError('Invalid label schema, exercise, or source')
    if labels.get('coachConfirmed') is not True or not all(
            isinstance(labels.get(key), str) and labels[key].strip()
            for key in ('reviewer', 'rubricVersion', 'approvedConditions', 'reviewedAt')):
        raise ValueError('Coach confirmation and approved conditions are required')
    if item.get('referenceStandardVersion') and labels['rubricVersion'] != item['referenceStandardVersion']:
        raise ValueError('Manifest/Coach rubric version mismatch')
    if item.get('exerciseVariant') and labels.get('exerciseVariant') != item['exerciseVariant']:
        raise ValueError('Manifest/Coach exercise variant mismatch')
    if labels.get('cameraView') not in ('SIDE', 'FRONT', 'OBLIQUE', 'UNKNOWN'):
        raise ValueError('Invalid Coach camera view')
    if labels.get('expectedStatus') not in ('ANALYZABLE', 'INSUFFICIENT_DATA', 'WRONG_EXERCISE'):
        raise ValueError('Invalid Coach analyzability label')
    duration = labels.get('durationSeconds')
    if not _finite(duration) or duration <= 0:
        raise ValueError('Labels require the actual video duration')
    expected = _criterion_ids(item)
    segments = labels.get('segments')
    if not isinstance(segments, list):
        raise ValueError('Missing Coach segments')
    previous = -1
    for segment in segments:
        start, end = segment.get('startSeconds'), segment.get('endSeconds')
        if not all(_finite(value) for value in (start, end)) or not 0 <= start < end <= duration + .05 or start < previous:
            raise ValueError('Invalid or overlapping Coach segments')
        previous = end
        if set(segment.get('criteria', {})) != expected:
            raise ValueError('Each segment needs all exercise criteria')
        for label in segment['criteria'].values():
            outcome, at = label.get('outcome'), label.get('timestampSeconds')
            if outcome not in ('MEETS', 'IMPROVE', 'UNASSESSABLE') or not str(label.get('note', '')).strip():
                raise ValueError('Invalid or unexplained Coach criterion label')
            if outcome != 'UNASSESSABLE' and (not _finite(at) or not start <= at <= end):
                raise ValueError('Coach verdict needs evidence timestamp within segment')
    if labels['expectedStatus'] == 'ANALYZABLE' and not segments:
        raise ValueError('Analyzable footage needs a Coach segment')
    if labels['expectedStatus'] != 'ANALYZABLE' and any(
            label['outcome'] != 'UNASSESSABLE' for segment in segments for label in segment['criteria'].values()):
        raise ValueError('Unanalyzable/wrong-exercise clips cannot carry affirmative technique labels')


def temporal_iou(a, b):
    overlap = max(0, min(a['endSeconds'], b['endSeconds']) - max(a['startSeconds'], b['startSeconds']))
    union = max(a['endSeconds'], b['endSeconds']) - min(a['startSeconds'], b['startSeconds'])
    return overlap / union if union > 0 else 0


def match_segments(expected, predicted, threshold=.5):
    """One-to-one assignment; one prediction cannot cover multiple true reps."""
    candidates = sorted(((temporal_iou(truth, pred), index, guess)
                         for index, truth in enumerate(expected) for guess, pred in enumerate(predicted)),
                        reverse=True)
    matches, used = {}, set()
    for overlap, index, guess in candidates:
        if overlap >= threshold and index not in matches and guess not in used:
            matches[index] = guess
            used.add(guess)
    return matches, used


def _inference_version(result):
    evaluation = result.get('techniqueEvaluation', {})
    return evaluation.get('referenceStandardVersion') or result.get('referenceStandardVersion')


def _checked_result(item, labels, result):
    if result.get('exercise') != item['exercise']:
        raise ValueError('Inference exercise mismatch')
    if item.get('exerciseVariant') and result.get('techniqueEvaluation', {}).get('exerciseVariant') != item['exerciseVariant']:
        raise ValueError('Manifest/inference exercise variant mismatch')
    digest = result.get('inputVideoSha256') or result.get('testCase', {}).get('sha256')
    if digest != item['sha256']:
        raise ValueError('Inference artifact is not bound to this video SHA-256')
    version = _inference_version(result)
    if version and version != labels['rubricVersion']:
        raise ValueError('Inference/Coach reference standard version mismatch')
    if item.get('referenceStandardVersion') and version != item['referenceStandardVersion']:
        raise ValueError('Missing or mismatched inference reference standard version')
    codes = _criterion_ids(item)
    checks = result.get('techniqueEvaluation', {}).get('criteria', [])
    if not isinstance(checks, list):
        raise ValueError('Inference criteria must be a list')
    seen = set()
    for check in checks:
        code = check.get('criterionId') or check.get('code')
        if code in seen:
            raise ValueError('Duplicate inference criterion')
        seen.add(code)
        # A holdout may validate one criterion at a time while the inference
        # artifact still contains the full exercise standard. Only the
        # explicitly labeled criterion IDs contribute to this report.
        if code not in codes:
            continue
        for verdict in check.get('verdicts', []):
            start, end = verdict.get('startSeconds'), verdict.get('endSeconds')
            if not all(_finite(value) for value in (start, end)) or not 0 <= start < end <= labels['durationSeconds'] + .05:
                raise ValueError('Inference verdict interval is invalid')
            status = verdict.get('resultStatus') or verdict.get('status')
            if status in DECISIVE:
                at = verdict.get('timestampSeconds', verdict.get('timestamp'))
                verdict_version = verdict.get('referenceStandardVersion') or check.get('referenceStandardVersion') or version
                if verdict_version != labels['rubricVersion']:
                    raise ValueError('Definitive inference verdict requires a matching standard version')
                if not _finite(at) or not start <= at <= end:
                    raise ValueError('Definitive inference verdict requires an evidence timestamp')


def score(item, labels, result, temporal_threshold=.5, root=None):
    checked_labels(item, labels, root)
    _checked_result(item, labels, result)
    output = {code: _counts() for code in _criterion_ids(item)}
    checks = {(criterion.get('criterionId') or criterion.get('code')): criterion
              for criterion in result.get('techniqueEvaluation', {}).get('criteria', [])}
    for code, counts in output.items():
        verdicts = checks.get(code, {}).get('verdicts', [])
        pairs, used = match_segments(labels['segments'], verdicts, temporal_threshold)
        for index, segment in enumerate(labels['segments']):
            truth = segment['criteria'][code]
            pred = verdicts[pairs[index]] if index in pairs else {}
            prediction = DECISIVE.get(pred.get('resultStatus') or pred.get('status'))
            if truth['outcome'] == 'UNASSESSABLE':
                counts['coachUnassessable'] += 1
                # Track conclusions on unassessable segments without inventing
                # a positive/negative technique truth label.
                if prediction:
                    counts['falseAcceptance'] += 1
                continue
            counts['assessableLabels'] += 1
            if prediction is None:
                counts['abstained'] += 1
                if truth['outcome'] == 'IMPROVE':
                    counts['fn'] += 1
            elif prediction == 'NEEDS_IMPROVEMENT':
                counts['tp' if truth['outcome'] == 'IMPROVE' else 'fp'] += 1
            elif truth['outcome'] == 'IMPROVE':
                counts['fn'] += 1
                counts['falseAcceptance'] += 1
            else:
                counts['tn'] += 1
        for index, verdict in enumerate(verdicts):
            if index in used:
                continue
            prediction = DECISIVE.get(verdict.get('resultStatus') or verdict.get('status'))
            if prediction:
                counts['unmatchedPredictions'] += 1
            if prediction == 'NEEDS_IMPROVEMENT':
                counts['fp'] += 1
            if prediction and labels['expectedStatus'] != 'ANALYZABLE':
                counts['falseAcceptance'] += 1
    return output


def _rep_error(labels, result, exercise):
    if EXERCISES[exercise]['phase'] == 'HOLD':
        return None
    expected = len(labels['segments']) if labels['expectedStatus'] == 'ANALYZABLE' else 0
    count = result.get('detectedRepetitions')
    predicted = count if type(count) is int and count >= 0 else len(result.get('repetitions', []))
    return {'coachCount': expected, 'predictedCount': predicted, 'absoluteError': abs(expected - predicted),
            'countAbstained': count is None}


def _known_development_ids(root):
    """Exclude development assets even when the holdout manifest lists only holdout clips."""
    hashes, subjects, sessions = set(), set(), set()
    for relative, rows_key in (
        ('evaluation/technique-video-manifest.json', None),
        ('evaluation/debug-video-manifest.json', None),
        ('evaluation/SQUAT_DEV_VALIDATION_REPORT.json', 'videos'),
    ):
        catalog = root / relative
        if not catalog.is_file():
            continue
        document = json.loads(catalog.read_text(encoding='utf-8'))
        rows = document.get(rows_key, []) if rows_key else document
        if not isinstance(rows, list):
            raise ValueError(f'Invalid development catalog: {relative}')
        for row in rows:
            if row.get('sha256'):
                hashes.add(row['sha256'])
            if row.get('subjectId'):
                subjects.add(str(row['subjectId']))
            if row.get('sessionId'):
                sessions.add(str(row['sessionId']))
    return hashes, subjects, sessions


def evaluate(manifest, temporal_threshold=.5, root=None):
    root = Path(root or ROOT).resolve()
    document = json.loads(manifest.read_text(encoding='utf-8'))
    entries = document.get('clips', []) if isinstance(document, dict) else document
    if not isinstance(entries, list):
        raise ValueError('Manifest must contain a clip list')
    acceptance = document.get('acceptanceCriteria') if isinstance(document, dict) else None
    mode = document.get('evaluationMode', 'RUNTIME') if isinstance(document, dict) else 'RUNTIME'
    if mode not in ('RUNTIME', 'OFFLINE_CANDIDATE'):
        raise ValueError('Unknown evaluation mode')
    total = defaultdict(_counts)
    excluded, included, clip_results = [], 0, []
    development_hashes, development_subjects, development_sessions = _known_development_ids(root)
    development_hashes.update(entry.get('sha256') for entry in entries if entry.get('split') in ('train', 'validation', 'development'))
    development_subjects.update(str(entry['subjectId']) for entry in entries if entry.get('split') in ('train', 'validation', 'development') and entry.get('subjectId'))
    development_sessions.update(str(entry['sessionId']) for entry in entries if entry.get('split') in ('train', 'validation', 'development') and entry.get('sessionId'))
    seen_hashes = set()
    for index, item in enumerate(entries):
        identity = {'id': item.get('id', index), 'exercise': item.get('exercise'), 'path': item.get('path')}
        reason = None
        if not item.get('coachLabels'):
            reason = 'NO_COACH_LABELS'
        elif item.get('split') != 'holdout' or item.get('sourceType') != 'REAL':
            reason = 'NOT_REAL_HOLDOUT'
        elif not item.get('subjectId') or not item.get('sessionId'):
            reason = 'HOLDOUT_SUBJECT_AND_SESSION_REQUIRED'
        elif item.get('sha256') in development_hashes or str(item['subjectId']) in development_subjects or str(item['sessionId']) in development_sessions:
            reason = 'HOLDOUT_OVERLAPS_DEVELOPMENT'
        elif item.get('sha256') in seen_hashes:
            reason = 'DUPLICATE_VIDEO_HASH'
        elif not item.get('resultPath'):
            reason = 'EXPLICIT_PER_CLIP_RESULT_PATH_REQUIRED'
        if reason:
            excluded.append({**identity, 'reason': reason})
            continue
        try:
            labels = json.loads(_path(item['coachLabels'], root).read_text(encoding='utf-8'))
            result = json.loads(_path(item['resultPath'], root).read_text(encoding='utf-8'))
            if mode == 'OFFLINE_CANDIDATE':
                candidate = result.get('candidateTechniqueEvaluation') or {}
                if candidate.get('offlineOnly') is not True:
                    raise ValueError('Offline candidate artifact must be explicitly marked')
                result = {**result, 'techniqueEvaluation': candidate}
            scores = score(item, labels, result, temporal_threshold, root)
        except (ValueError, OSError, TypeError, KeyError) as error:
            excluded.append({**identity, 'reason': 'INVALID_LABELS_OR_INFERENCE', 'detail': str(error)})
            continue
        for code, counts in scores.items():
            for key, value in counts.items():
                total[f"{item['exercise']}:{code}"][key] += value
        seen_hashes.add(item['sha256'])
        included += 1
        clip_results.append({**identity, 'videoSha256': item['sha256'],
                             'labelsSha256': hashlib.sha256(_path(item['coachLabels'], root).read_bytes()).hexdigest(),
                             'inferenceSha256': hashlib.sha256(_path(item['resultPath'], root).read_bytes()).hexdigest(),
                             'labelsPath': item['coachLabels'], 'resultPath': item['resultPath'],
                             'referenceStandardVersion': _inference_version(result),
                             'repCounting': _rep_error(labels, result, item['exercise']), 'metrics': scores})
    metrics = {}
    for key, counts in total.items():
        tp, fp, fn = counts['tp'], counts['fp'], counts['fn']
        metrics[key] = {**counts, 'precision': tp / (tp + fp) if tp + fp else None,
                        'recall': tp / (tp + fn) if tp + fn else None,
                        'abstentionRate': counts['abstained'] / counts['assessableLabels'] if counts['assessableLabels'] else None}
    errors = [row['repCounting']['absoluteError'] for row in clip_results if row['repCounting'] is not None]
    manifest_path = manifest.resolve()
    if not manifest_path.is_relative_to(root):
        raise ValueError('Manifest must be stored within the evaluation workspace')
    return {'status': 'EVALUATED' if included else 'INSUFFICIENT_GROUND_TRUTH',
            'inputManifest': {'path': str(manifest_path.relative_to(root)),
                              'sha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest()},
            'includedRealHoldoutVideos': included, 'excluded': excluded, 'metrics': metrics,
            'clips': clip_results, 'repCountMAE': sum(errors) / len(errors) if errors else None,
            'temporalIoUThreshold': temporal_threshold,
            'evaluationMode': mode,
            'acceptanceCriteria': acceptance, 'acceptanceStatus': 'NOT_ASSESSED',
            'note': 'Coach expertise, source footage and split independence require human review. Missing labels yield no accuracy metrics. Acceptance targets must be fixed before holdout inference; this evaluator does not invent them.'}


def build_offline_candidate(inference, standard, use_default_candidates=False):
    """Dry-run proposed conditions into a separate, never-Mobile namespace.

    Existing runtime decisions remain untouched. Candidate policy outcomes are
    only inputs to independent Coach validation, not approved technique claims.
    """
    from criterion_evaluation import compare_measurement, default_candidate_policy, reference_digest
    if inference.get('exercise') != standard.get('exerciseId'):
        raise ValueError('Candidate exercise mismatch')
    result = deepcopy(inference)
    runtime = result.get('techniqueEvaluation') or {}
    candidate = deepcopy(runtime)
    candidate.update(offlineOnly=True, evaluationMode='OFFLINE_CANDIDATE',
                     referenceStandardVersion=standard['standardVersion'],
                     reviewedStandardDigest=reference_digest(standard))
    definitions = {criterion['criterionId']: criterion for criterion in standard['criteria']}
    variant = runtime.get('exerciseVariant')
    camera = result.get('cameraView', {}).get('detected')
    cfg_values = ((result.get('thresholdConfig') or {}).get('values') or {})
    protocol = result.get('protocol') or {}
    for criterion in candidate.get('criteria', []):
        cid = criterion.get('criterionId') or criterion.get('code')
        definition = definitions.get(cid)
        criterion['verdicts'] = []
        if (not definition or definition.get('type') == 'D'
                or definition.get('evaluationPolicy', {}).get('status') == 'NOT_SUPPORTED'
                or variant != standard['exerciseVariant']
                or camera not in definition['requiredCameraAngles']):
            continue
        policy = deepcopy(definition.get('evaluationPolicy') or {})
        if use_default_candidates and not policy.get('passCondition'):
            fallback = default_candidate_policy(cid, cfg_values, protocol)
            if fallback:
                policy.update(fallback)
        for row in (criterion.get('measurement') or {}).get('perRep', []):
            if not row.get('measurementQuality', {}).get('sufficientForExperimentalComparison') or not row.get('landmarkEvidence'):
                continue
            status, target, reason = compare_measurement(row.get('observedValue') or {}, protocol, policy)
            criterion['verdicts'].append({**row, 'resultStatus': status or 'MEASURED',
                                          'targetValue': target, 'reasonCode': reason,
                                          'referenceStandardVersion': standard['standardVersion'],
                                          'offlineOnly': True})
    result['candidateTechniqueEvaluation'] = candidate
    return result


def generate_coach_label_template(inference, video_sha256=''):
    """Create an unconfirmed Coach label template pre-segmented from inference."""
    from standard_registry import load_standard
    exercise = inference.get('exercise', 'SQUAT')
    runtime = inference.get('techniqueEvaluation') or {}
    criteria_ids = [c.get('criterionId') or c.get('code') for c in runtime.get('criteria', [])]
    if not criteria_ids:
        try:
            criteria_ids = [c['criterionId'] for c in load_standard(exercise)['criteria']]
        except ValueError:
            criteria_ids = []
    segments = []
    for rep in inference.get('repetitions') or []:
        start = rep.get('startSeconds', 0.0)
        end = rep.get('endSeconds', 0.0)
        bottom = rep.get('bottomSeconds', round((start + end) / 2, 3))
        segments.append({
            'repNumber': rep.get('number'),
            'startSeconds': start,
            'bottomSeconds': bottom,
            'endSeconds': end,
            'criteria': {
                cid: {
                    'outcome': 'UNASSESSABLE',
                    'timestampSeconds': bottom,
                    'note': 'Template awaiting Coach evaluation (change outcome to MEETS, IMPROVE, or UNASSESSABLE and set coachConfirmed=true)',
                }
                for cid in criteria_ids if cid
            },
        })
    return {
        'schemaVersion': 2,
        'exercise': exercise,
        'exerciseVariant': runtime.get('exerciseVariant') or inference.get('exerciseVariant') or 'BODYWEIGHT',
        'sourceType': 'REAL',
        'videoSha256': inference.get('inputVideoSha256') or video_sha256 or '',
        'durationSeconds': (inference.get('video') or {}).get('durationSeconds'),
        'coachConfirmed': False,
        'reviewer': '',
        'rubricVersion': runtime.get('referenceStandardVersion', 'bodyweight-squat-1.0.0-draft'),
        'approvedConditions': '',
        'reviewedAt': '',
        'cameraView': (inference.get('cameraView') or {}).get('detected', 'UNKNOWN'),
        'expectedStatus': 'ANALYZABLE' if segments else 'INSUFFICIENT_DATA',
        'segments': segments,
    }


def check_release_readiness(standard, validation_report, acceptance_doc=None):
    """Audit each criterion against Coach approval and holdout acceptance gates."""
    from criterion_evaluation import default_candidate_policy, reference_digest, released_policy
    digest = reference_digest(standard)
    exercise = standard.get('exerciseId', 'SQUAT')
    acceptance_map = (acceptance_doc or {}).get('criteria') or {}
    default_acc = (acceptance_doc or {}).get('defaultAcceptanceCriteria') or {
        'id': 'SQUAT-BODYWEIGHT-V1-ACCEPTANCE',
        'declaredAt': '2026-10-01T00:00:00Z',
        'minimumPrecision': 0.80,
        'minimumRecall': 0.80,
        'maximumAbstentionRate': 0.20,
        'minimumPositiveLabels': 5,
        'minimumNegativeLabels': 5,
        'minimumVideos': 3,
    }
    rows = []
    for criterion in standard.get('criteria', []):
        cid = criterion['criterionId']
        policy = criterion.get('evaluationPolicy') or {}
        released, blocker = released_policy(standard, criterion)
        metric_key = f'{exercise}:{cid}'
        metric = (validation_report.get('metrics') or {}).get(metric_key)
        acc = acceptance_map.get(cid, default_acc)
        missing = []
        if criterion.get('type') == 'D' or policy.get('status') == 'NOT_SUPPORTED':
            missing.append('NOT_SUPPORTED_IN_2D_MONOCULAR')
        else:
            if policy.get('status') != 'APPROVED_AND_VALIDATED':
                missing.append('POLICY_STATUS_NOT_APPROVED_AND_VALIDATED')
            if not policy.get('approvedByCoach'):
                missing.append('MISSING_COACH_APPROVAL_PROVENANCE')
            if not policy.get('passCondition') and default_candidate_policy(cid) is None:
                missing.append('MISSING_PASS_CONDITION')
            if validation_report.get('includedRealHoldoutVideos', 0) < acc.get('minimumVideos', 3):
                missing.append(f"INSUFFICIENT_HOLDOUT_VIDEOS ({validation_report.get('includedRealHoldoutVideos', 0)}/{acc.get('minimumVideos', 3)})")
            if not metric:
                missing.append('NO_HOLDOUT_METRICS_FOR_CRITERION')
            else:
                pos = metric.get('tp', 0) + metric.get('fn', 0)
                neg = metric.get('tn', 0) + metric.get('fp', 0)
                if pos < acc.get('minimumPositiveLabels', 5):
                    missing.append(f"INSUFFICIENT_POSITIVE_LABELS ({pos}/{acc.get('minimumPositiveLabels', 5)})")
                if neg < acc.get('minimumNegativeLabels', 5):
                    missing.append(f"INSUFFICIENT_NEGATIVE_LABELS ({neg}/{acc.get('minimumNegativeLabels', 5)})")
                if metric.get('precision') is None or metric['precision'] < acc.get('minimumPrecision', 0.8):
                    missing.append('PRECISION_BELOW_TARGET')
                if metric.get('recall') is None or metric['recall'] < acc.get('minimumRecall', 0.8):
                    missing.append('RECALL_BELOW_TARGET')
                if metric.get('abstentionRate') is None or metric['abstentionRate'] > acc.get('maximumAbstentionRate', 0.2):
                    missing.append('ABSTENTION_ABOVE_MAXIMUM')
        rows.append({
            'criterionId': cid,
            'criterionName': criterion.get('criterionName'),
            'type': criterion.get('type'),
            'policyStatus': policy.get('status'),
            'readyForApprovedAndValidated': released is not None and blocker is None,
            'releaseGateBlocker': blocker,
            'missingRequirements': missing,
            'candidatePolicyAvailable': default_candidate_policy(cid) is not None,
            'candidatePolicy': default_candidate_policy(cid),
            'acceptanceCriteria': acc,
            'holdoutMetrics': metric,
        })
    return {
        'exerciseId': exercise,
        'exerciseVariant': standard.get('exerciseVariant'),
        'standardVersion': standard.get('standardVersion'),
        'standardDigest': digest,
        'validationStatus': validation_report.get('status'),
        'includedRealHoldoutVideos': validation_report.get('includedRealHoldoutVideos', 0),
        'criteria': rows,
    }


if __name__ == '__main__':
    import sys
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', type=Path, default=ROOT / 'evaluation' / 'technique-video-manifest.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'evaluation' / 'TECHNIQUE_VALIDATION.json')
    parser.add_argument('--temporal-iou', type=float, default=.5)
    parser.add_argument('--candidate-input', type=Path)
    parser.add_argument('--candidate-standard', type=Path)
    parser.add_argument('--candidate-output', type=Path)
    parser.add_argument('--use-default-candidates', action='store_true')
    parser.add_argument('--prepare-template', type=Path)
    parser.add_argument('--template-output', type=Path)
    parser.add_argument('--check-readiness', action='store_true')
    parser.add_argument('--acceptance-criteria', type=Path, default=ROOT / 'evaluation' / 'acceptance-criteria.json')
    args = parser.parse_args()
    if not 0 < args.temporal_iou <= 1:
        parser.error('--temporal-iou must be greater than zero and at most one')
    if args.prepare_template:
        inference = json.loads(args.prepare_template.read_text(encoding='utf-8'))
        template = generate_coach_label_template(inference)
        target_out = args.template_output or args.prepare_template.with_suffix('.labels.template.json')
        target_out.write_text(json.dumps(template, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
        print('UNCONFIRMED_COACH_TEMPLATE_WRITTEN', str(target_out))
        raise SystemExit(0)
    candidate_arguments = (args.candidate_input, args.candidate_standard, args.candidate_output)
    if any(candidate_arguments):
        if not all(candidate_arguments):
            parser.error('Candidate dry-run needs --candidate-input, --candidate-standard and --candidate-output')
        inference = json.loads(args.candidate_input.read_text(encoding='utf-8'))
        standard = json.loads(args.candidate_standard.read_text(encoding='utf-8'))
        args.candidate_output.write_text(
            json.dumps(build_offline_candidate(inference, standard, use_default_candidates=args.use_default_candidates),
                       ensure_ascii=False, indent=2, allow_nan=False),
            encoding='utf-8')
        print('OFFLINE_CANDIDATE_ONLY; runtime techniqueEvaluation unchanged')
        raise SystemExit(0)
    report = evaluate(args.manifest, args.temporal_iou)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    if args.check_readiness:
        from standard_registry import load_standard
        acc_doc = json.loads(args.acceptance_criteria.read_text(encoding='utf-8')) if args.acceptance_criteria.exists() else None
        readiness = check_release_readiness(load_standard('SQUAT'), report, acc_doc)
        (ROOT / 'evaluation' / 'RELEASE_READINESS.json').write_text(
            json.dumps(readiness, ensure_ascii=False, indent=2, allow_nan=False),
            encoding='utf-8')
        print(json.dumps(readiness, ensure_ascii=False, indent=2))
    else:
        print(report['status'], report['includedRealHoldoutVideos'], 'Coach-labeled holdout videos')
