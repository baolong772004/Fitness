"""Read-only, versioned technical references and explicit approval metadata.

Sources are coaching references, not validation of our 2D measurement code.
Runtime activation belongs to the technique evaluator and requires additional
verified validation evidence; merely editing a JSON approval is insufficient.
"""
from copy import deepcopy
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent / 'standards'
ACTIVE_ROOT = ROOT / 'active'
_HASH = re.compile(r'^[a-f0-9]{64}$')
_CRITERION_FIELDS = ('criterionId', 'criterionName', 'description', 'type',
                     'applicableExerciseVariants', 'requiredCameraAngles',
                     'requiredLandmarks', 'measurementMethod', 'evaluationMethod',
                     'referenceRangeOrTarget', 'thresholdSource', 'passCondition',
                     'improvementCondition', 'insufficientDataCondition',
                     'evidenceRequirements', 'correctionAdvice', 'limitations',
                     'validationStatus', 'implementationKey', 'evaluationPolicy')


def standard_digest(standard):
    """Hash exact standard content, independent of whitespace or key ordering."""
    return hashlib.sha256(json.dumps(standard, sort_keys=True, ensure_ascii=False,
                                     separators=(',', ':'), allow_nan=False).encode('utf-8')).hexdigest()


def approval_digest(standard):
    """Bind a review to content while excluding its own approval envelope."""
    content = deepcopy(standard)
    for key in ('approvedByCoach', 'approvedAt', 'approvedStandardDigest'):
        content.pop(key, None)
    for criterion in content.get('criteria', []):
        for key in ('approvedByCoach', 'approvedAt', 'approvedStandardDigest'):
            criterion.pop(key, None)
        policy = criterion.get('evaluationPolicy', {})
        for key in ('approvedByCoach', 'approvedAt', 'approvedStandardDigest', 'validationReport', 'status'):
            policy.pop(key, None)
    return standard_digest(content)


def _date(value):
    if not isinstance(value, str):
        return False
    try:
        datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return False
    return True


def validate_standard(standard):
    """Validate metadata before reading a standard; raises on malformed approval.

    DRAFT policies never imply approval. An APPROVED policy needs provenance,
    reviewer qualifications, a version-matched validation report hash and scope.
    This validates structure only, not the authenticity of a reviewer or report.
    """
    required = ('exerciseId', 'exerciseName', 'exerciseVariant', 'equipment',
                'trainingLevel', 'referenceSources', 'approvedByCoach',
                'approvedAt', 'standardVersion', 'startingPosition',
                'movementPhases', 'criteria', 'measurementConfiguration',
                'algorithmThresholds', 'individualTrainingTargetSchema')
    if not isinstance(standard, dict) or any(key not in standard for key in required):
        raise ValueError('Incomplete exercise standard')
    if standard.get('schemaVersion') != 1 or not all(isinstance(standard[key], str) and standard[key].strip()
                                                  for key in ('exerciseId', 'exerciseName', 'exerciseVariant', 'standardVersion')):
        raise ValueError('Invalid standard identity')
    if not standard['referenceSources'] or not standard['criteria'] or not standard['movementPhases']:
        raise ValueError('Sources, criteria and phases are required')
    source_ids = set()
    for source in standard['referenceSources']:
        if not all(source.get(key) for key in ('sourceId', 'title', 'url', 'publisher', 'summary', 'accessedAt')):
            raise ValueError('Incomplete reference source')
        if not str(source['url']).startswith('https://') or not _date(source['accessedAt']):
            raise ValueError('Invalid source URL/date')
        if source['sourceId'] in source_ids:
            raise ValueError('Duplicate reference source')
        source_ids.add(source['sourceId'])
    identities = set()
    for criterion in standard['criteria']:
        if any(key not in criterion for key in _CRITERION_FIELDS):
            raise ValueError('Incomplete criterion')
        identity = criterion['criterionId']
        if not isinstance(identity, str) or not identity.strip() or identity in identities:
            raise ValueError('Invalid or duplicate criterion identity')
        identities.add(identity)
        if criterion['type'] not in ('A', 'B', 'C', 'D'):
            raise ValueError('Invalid criterion type')
        if standard['exerciseVariant'] not in criterion['applicableExerciseVariants']:
            raise ValueError('Criterion variant does not match standard')
        if any(view not in ('SIDE', 'FRONT', 'OBLIQUE', 'ANY_TRACKED') for view in criterion['requiredCameraAngles']):
            raise ValueError('Invalid criterion camera angle')
        if any(source not in source_ids for source in criterion.get('referenceSourceIds', [])):
            raise ValueError('Unknown criterion reference source')
        policy = criterion['evaluationPolicy']
        if not isinstance(policy, dict) or policy.get('status') not in ('EXPERIMENTAL', 'NOT_SUPPORTED', 'APPROVED_AND_VALIDATED'):
            raise ValueError('Invalid evaluation policy')
        if policy['status'] == 'APPROVED_AND_VALIDATED':
            reviewer = policy.get('approvedByCoach')
            report = policy.get('validationReport')
            if not isinstance(reviewer, dict) or not all(reviewer.get(key) for key in ('reviewerId', 'qualification', 'reviewRecordId')):
                raise ValueError('Qualified Coach approval provenance required')
            if not _date(policy.get('approvedAt')) or not isinstance(report, dict):
                raise ValueError('Approval date and validation report required')
            if not all(report.get(key) for key in ('path', 'sha256', 'standardVersion', 'criterionId', 'scope', 'acceptanceCriteriaId')):
                raise ValueError('Incomplete validation report metadata')
            if not _HASH.fullmatch(str(report['sha256'])) or report['standardVersion'] != standard['standardVersion'] or report['criterionId'] != identity:
                raise ValueError('Validation report hash/version/criterion mismatch')
            if not report['scope'].get('exerciseVariant') == standard['exerciseVariant']:
                raise ValueError('Validation scope must match variant')
            if criterion['type'] == 'D' or not policy.get('passCondition') or not policy.get('improvementCondition'):
                raise ValueError('Unsupported or conditionless criteria cannot be approved')
        elif any(policy.get(key) is not None for key in ('approvedByCoach', 'approvedAt', 'validationReport')):
            raise ValueError('Unapproved criterion cannot carry approval metadata')
    if (standard['approvedByCoach'] is None) != (standard['approvedAt'] is None):
        raise ValueError('Standard reviewer and approval date must be recorded together')
    if standard['approvedAt'] is not None and not _date(standard['approvedAt']):
        raise ValueError('Invalid standard approval date')
    if standard.get('status') == 'SUPPORTED' and (standard['approvedByCoach'] is None
            or not any(c['evaluationPolicy']['status'] == 'APPROVED_AND_VALIDATED' for c in standard['criteria'])):
        raise ValueError('Supported status requires reviewed, validated criteria')
    if standard['measurementConfiguration'].get('source') != 'IMPLEMENTATION_CONFIGURATION':
        raise ValueError('Measurement configuration must remain separate from coaching reference')
    if standard['algorithmThresholds'].get('source') != 'EXPERIMENTAL_ALGORITHM_CONFIGURATION':
        raise ValueError('Algorithm thresholds must be identified as experimental')
    return standard


def _standards():
    index = json.loads((ROOT / 'index.json').read_text(encoding='utf-8'))
    result = []
    for entry in index['standards']:
        relative = Path(entry['path'])
        path = (ROOT / relative).resolve()
        if not path.is_relative_to(ROOT.resolve()) or path.suffix != '.json':
            raise ValueError('Invalid registry path')
        base = validate_standard(json.loads(path.read_text(encoding='utf-8')))
        if any(base[key] != entry[key] for key in ('exerciseId', 'exerciseVariant', 'standardVersion')):
            raise ValueError('Registry index identity mismatch')
        active_path = ACTIVE_ROOT / f"{base['exerciseId'].lower()}-{base['exerciseVariant'].lower()}.json"
        standard = base
        if active_path.is_file():
            active = json.loads(active_path.read_text(encoding='utf-8'))
            if active.get('baseStandardDigest') != standard_digest(base):
                raise ValueError('Released standard no longer matches the source draft')
            standard = validate_standard(active.get('standard'))
            if any(standard[key] != base[key] for key in ('exerciseId', 'exerciseVariant', 'standardVersion')):
                raise ValueError('Released standard identity mismatch')
        result.append(standard)
    return result


def load_standard(exercise, variant=None):
    """Return an independent plain dict. Unknown/unspecified variants fail closed.

    Omitting variant selects the registry's sole reference variant for authoring;
    evaluators must supply the user's explicit variant before applying a policy.
    """
    exercise = str(exercise).upper()
    variants = [item for item in _standards() if item['exerciseId'] == exercise]
    if variant is not None:
        variants = [item for item in variants if item['exerciseVariant'] == variant]
    if len(variants) != 1:
        raise ValueError('No unambiguous reference standard for exercise/variant')
    return deepcopy(variants[0])


def list_standards():
    return [{'exerciseId': item['exerciseId'], 'exerciseName': item['exerciseName'],
             'exerciseVariant': item['exerciseVariant'], 'standardVersion': item['standardVersion'],
             'status': item['status'], 'approvedByCoach': item['approvedByCoach'],
             'approvedAt': item['approvedAt'], 'criterionCount': len(item['criteria']),
             'digest': standard_digest(item)} for item in _standards()]
