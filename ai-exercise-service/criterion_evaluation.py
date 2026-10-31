"""Execute only explicitly released criterion policies; defaults remain draft.

The release gate uses a server-owned standard plus a hash-bound evaluation
artifact. Client options and Coach plan notes cannot activate a policy.
"""
import hashlib
import json
import math
from datetime import datetime
from pathlib import Path
from standard_registry import approval_digest

ROOT = Path(__file__).resolve().parent


def _timestamp(value):
    if not isinstance(value, str):
        raise ValueError('Timestamp required')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Timezone required')
    return parsed


def _acceptance_met(evidence, report, actual, standard, criterion, artifact):
    """Check independently recomputed counts against predeclared targets."""
    scope = evidence.get('scope')
    if not isinstance(scope, dict) or scope != artifact.get('scope'):
        return False
    if (scope.get('exerciseVariant') != standard['exerciseVariant']
            or not scope.get('modelVersion') or not scope.get('ruleVersion')
            or not isinstance(scope.get('cameraViews'), list) or not scope['cameraViews']
            or not set(scope['cameraViews']).issubset(set(criterion['requiredCameraAngles']))):
        return False
    criteria = evidence.get('acceptanceCriteria') or {}
    if criteria.get('id') != artifact.get('acceptanceCriteriaId'):
        return False
    try:
        if not (_timestamp(criteria['declaredAt']) <= _timestamp(evidence['holdoutStartedAt']) <= _timestamp(evidence['evaluatedAt'])):
            return False
    except (ValueError, KeyError, TypeError):
        return False
    for key in ('minimumPrecision', 'minimumRecall', 'maximumAbstentionRate'):
        if not _number(criteria.get(key)) or not 0 <= criteria[key] <= 1:
            return False
    for key in ('minimumPositiveLabels', 'minimumNegativeLabels', 'minimumVideos'):
        if type(criteria.get(key)) is not int or criteria[key] < 1:
            return False
    key = f"{standard['exerciseId']}:{criterion['criterionId']}"
    metrics = actual.get('metrics', {}).get(key)
    reported = report.get('metrics', {}).get(key)
    if not isinstance(metrics, dict) or reported != metrics:
        return False
    # The evaluator derives these from integer confusion counts; a report's
    # acceptanceMet flag or hand-entered precision is insufficient.
    if (not all(_number(metrics.get(name)) for name in ('precision', 'recall', 'abstentionRate'))
            or metrics['tp'] + metrics['fn'] < criteria['minimumPositiveLabels']
            or metrics['assessableLabels'] - metrics['tp'] - metrics['fn'] < criteria['minimumNegativeLabels']
            or actual['includedRealHoldoutVideos'] < criteria['minimumVideos']):
        return False
    return (metrics['precision'] >= criteria['minimumPrecision']
            and metrics['recall'] >= criteria['minimumRecall']
            and metrics['abstentionRate'] <= criteria['maximumAbstentionRate'])


def reference_digest(standard):
    return approval_digest(standard)


def released_policy(standard, criterion, report_root=ROOT):
    policy = criterion.get('evaluationPolicy') or {}
    if policy.get('status') != 'APPROVED_AND_VALIDATED':
        return None, 'NOT_COACH_VALIDATED'
    if not all(standard.get(k) and policy.get(k) for k in ('approvedByCoach', 'approvedAt')):
        return None, 'MISSING_EXPERT_APPROVAL'
    reviewer = policy.get('approvedByCoach')
    if not isinstance(reviewer, dict) or not all(reviewer.get(key) for key in ('reviewerId', 'qualification', 'reviewRecordId')):
        return None, 'MISSING_EXPERT_APPROVAL'
    if policy.get('approvedStandardDigest') != reference_digest(standard):
        return None, 'STANDARD_CHANGED_AFTER_APPROVAL'
    artifact = policy.get('validationReport') or {}
    try:
        root = Path(report_root).resolve()
        path = (root / artifact['path']).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            return None, 'VALIDATION_REPORT_UNAVAILABLE'
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != artifact['sha256']:
            return None, 'VALIDATION_REPORT_HASH_MISMATCH'
        report = json.loads(raw)
    except (KeyError, TypeError, ValueError, OSError):
        return None, 'VALIDATION_REPORT_UNAVAILABLE'
    criterion_id = criterion.get('criterionId', criterion.get('code'))
    evidence = report.get('releaseEvidence', {}).get(criterion_id, {})
    try:
        if _timestamp(reviewer['reviewedAt']) > _timestamp(evidence['holdoutStartedAt']):
            return None, 'COACH_RULE_REVIEW_AFTER_HOLDOUT'
    except (KeyError, TypeError, ValueError):
        return None, 'PRE_HOLDOUT_COACH_RULE_REVIEW_REQUIRED'
    # Acceptance targets must be set before the independent holdout is run.
    if (report.get('status') != 'EVALUATED' or report.get('includedRealHoldoutVideos', 0) < 1
            or evidence.get('standardVersion') != standard.get('standardVersion')
            or evidence.get('reviewedStandardDigest') != reference_digest(standard)
            or evidence.get('criterionId') != criterion_id
            or artifact.get('standardVersion') != standard['standardVersion']
            or artifact.get('criterionId') != criterion_id
            or evidence.get('independentCoachReview') is not True):
        return None, 'CRITERION_NOT_VIDEO_VALIDATED'
    try:
        # Re-score saved artifacts rather than trusting a claimed accuracy.
        # This reads hashes/JSON only and never invokes inference or this gate.
        from evaluate_technique import evaluate
        manifest_info = report['inputManifest']
        manifest = (root / manifest_info['path']).resolve()
        if not manifest.is_relative_to(root) or hashlib.sha256(manifest.read_bytes()).hexdigest() != manifest_info['sha256']:
            return None, 'VALIDATION_INPUTS_CHANGED'
        actual = evaluate(manifest, report['temporalIoUThreshold'], root=root)
        if (actual['status'] != 'EVALUATED' or actual['excluded']
                or actual['includedRealHoldoutVideos'] != report['includedRealHoldoutVideos']
                or actual['clips'] != report.get('clips')
                or actual['evaluationMode'] != report.get('evaluationMode')
                or not _acceptance_met(evidence, report, actual, standard, criterion, artifact)):
            return None, 'VALIDATION_ACCEPTANCE_NOT_MET'
        # Every accepted clip must belong to the released reference/model scope.
        entries = json.loads(manifest.read_text(encoding='utf-8'))
        entries = entries.get('clips', []) if isinstance(entries, dict) else entries
        for entry in entries:
            inference = json.loads((root / entry['resultPath']).read_text(encoding='utf-8'))
            labels = json.loads((root / entry['coachLabels']).read_text(encoding='utf-8'))
            candidate = inference.get('candidateTechniqueEvaluation') if report.get('evaluationMode') == 'OFFLINE_CANDIDATE' else None
            if (inference.get('modelVersion') != evidence['scope']['modelVersion']
                    or inference.get('ruleVersion') != evidence['scope']['ruleVersion']
                    or inference.get('techniqueEvaluation', {}).get('exerciseVariant') != evidence['scope']['exerciseVariant']
                    or labels.get('exerciseVariant') != evidence['scope']['exerciseVariant']
                    or labels.get('cameraView') not in evidence['scope']['cameraViews']):
                return None, 'VALIDATION_SCOPE_MISMATCH'
            if candidate and candidate.get('reviewedStandardDigest') != reference_digest(standard):
                return None, 'VALIDATION_SCOPE_MISMATCH'
    except (KeyError, TypeError, ValueError, OSError):
        return None, 'VALIDATION_INPUTS_UNAVAILABLE'
    return policy, None


def _number(value):
    return type(value) in (int, float) and math.isfinite(value)


def _condition(observed, targets, condition):
    if not isinstance(condition, dict):
        return None, None, 'UNIMPLEMENTED_EVALUATION_METHOD'
    kind = condition.get('kind')
    if kind in ('ALL_OF', 'ANY_OF'):
        subconditions = condition.get('conditions')
        if not isinstance(subconditions, list) or not subconditions:
            return None, None, 'UNIMPLEMENTED_EVALUATION_METHOD'
        outcomes, subtargets = [], []
        for sub in subconditions:
            matched, subtarget, reason = _condition(observed, targets, sub)
            if reason:
                return None, subtarget, reason
            outcomes.append(bool(matched))
            if subtarget is not None:
                subtargets.append(subtarget)
        passed = all(outcomes) if kind == 'ALL_OF' else any(outcomes)
        return passed, {'kind': kind, 'conditions': subtargets}, None
    if kind == 'BOOLEAN_EQUALS':
        key = condition.get('observedKey')
        expected = condition.get('expected', True)
        actual = observed.get(key)
        if not isinstance(actual, bool) or not isinstance(expected, bool):
            return None, None, 'MISSING_OBSERVED_VALUE'
        return actual is expected, {'observedKey': key, 'expected': expected}, None
    actual = observed.get(condition.get('observedKey'))
    if not _number(actual):
        return None, None, 'MISSING_OBSERVED_VALUE'
    if kind == 'NUMERIC_RANGE':
        minimum, maximum = condition.get('minimum'), condition.get('maximum')
        if not (_number(minimum) and _number(maximum) and minimum <= maximum):
            return None, None, 'INVALID_APPROVED_RANGE'
        passed = minimum <= actual <= maximum
        target = {'minimum': minimum, 'maximum': maximum}
    elif kind == 'TARGET_TOLERANCE':
        target_value = targets.get(condition.get('targetKey'))
        tolerance = condition.get('tolerance')
        if not _number(target_value):
            return None, None, 'GOAL_NOT_SET'
        if not _number(tolerance) or tolerance < 0:
            return None, None, 'INVALID_APPROVED_TOLERANCE'
        passed = abs(actual - target_value) <= tolerance
        target = {'value': target_value, 'tolerance': tolerance}
    else:
        return None, None, 'UNIMPLEMENTED_EVALUATION_METHOD'
    return passed, target, None


def default_candidate_policy(criterion_id, config_values=None, protocol=None):
    """Return structured candidate pass/improvement rules for assessable Squat criteria."""
    cfg = config_values or {}
    protocol = protocol or {}
    min_rep = float(cfg.get('minimum_rep_seconds', 0.6))
    knee_inward = float(cfg.get('knee_inward_ratio', 0.10))
    torso_inc = float(cfg.get('torso_increase_degrees', 12.0))
    hip_shoulder = float(cfg.get('hip_shoulder_rise_ratio', 0.12))
    tempo_tol = float(cfg.get('tempo_tolerance_seconds', 0.30))
    if criterion_id == 'SQUAT-01':
        return {
            'passCondition': {
                'kind': 'ALL_OF',
                'conditions': [
                    {'kind': 'BOOLEAN_EQUALS', 'observedKey': 'completedCycleObserved', 'expected': True},
                    {'kind': 'NUMERIC_RANGE', 'observedKey': 'totalSeconds', 'minimum': min_rep, 'maximum': 15.0},
                    {'kind': 'NUMERIC_RANGE', 'observedKey': 'descentSeconds', 'minimum': 0.2, 'maximum': 10.0},
                    {'kind': 'NUMERIC_RANGE', 'observedKey': 'ascentSeconds', 'minimum': 0.2, 'maximum': 10.0},
                ],
            },
            'improvementCondition': {'kind': 'COMPLEMENT_OF_PASS'},
        }
    if criterion_id == 'SQUAT-02':
        return {
            'passCondition': {'kind': 'NUMERIC_RANGE', 'observedKey': 'hipAboveKneeRatio', 'minimum': -1.0, 'maximum': 0.0},
            'improvementCondition': {'kind': 'COMPLEMENT_OF_PASS'},
        }
    if criterion_id == 'SQUAT-03':
        return {
            'passCondition': {'kind': 'NUMERIC_RANGE', 'observedKey': 'inwardChangeStanceRatio', 'minimum': -1.0, 'maximum': knee_inward},
            'improvementCondition': {'kind': 'COMPLEMENT_OF_PASS'},
        }
    if criterion_id == 'SQUAT-04':
        return {
            'passCondition': {
                'kind': 'ANY_OF',
                'conditions': [
                    {'kind': 'NUMERIC_RANGE', 'observedKey': 'earlyAscentLeanChangeDegrees', 'minimum': -90.0, 'maximum': torso_inc},
                    {'kind': 'NUMERIC_RANGE', 'observedKey': 'hipShoulderRiseDifferenceRatio', 'minimum': -2.0, 'maximum': hip_shoulder},
                ],
            },
            'improvementCondition': {'kind': 'COMPLEMENT_OF_PASS'},
        }
    if criterion_id == 'SQUAT-05':
        return {
            'passCondition': {
                'kind': 'ALL_OF',
                'conditions': [
                    {'kind': 'NUMERIC_RANGE', 'observedKey': 'descentDifferenceFromClipMedianSeconds', 'minimum': -tempo_tol, 'maximum': tempo_tol},
                    {'kind': 'NUMERIC_RANGE', 'observedKey': 'ascentDifferenceFromClipMedianSeconds', 'minimum': -tempo_tol, 'maximum': tempo_tol},
                    {'kind': 'NUMERIC_RANGE', 'observedKey': 'descentSeconds', 'minimum': 0.25, 'maximum': 10.0},
                    {'kind': 'NUMERIC_RANGE', 'observedKey': 'ascentSeconds', 'minimum': 0.25, 'maximum': 10.0},
                ],
            },
            'improvementCondition': {'kind': 'COMPLEMENT_OF_PASS'},
        }
    if criterion_id == 'SQUAT-08':
        if protocol.get('descentTargetSeconds') is not None:
            return {
                'passCondition': {
                    'kind': 'TARGET_TOLERANCE',
                    'observedKey': 'descentSeconds',
                    'targetKey': 'descentTargetSeconds',
                    'tolerance': tempo_tol,
                },
                'improvementCondition': {'kind': 'COMPLEMENT_OF_PASS'},
            }
        return {
            'passCondition': {'kind': 'NUMERIC_RANGE', 'observedKey': 'hipAboveKneeRatio', 'minimum': -1.0, 'maximum': 0.0},
            'improvementCondition': {'kind': 'COMPLEMENT_OF_PASS'},
        }
    return None


def compare_measurement(observed, targets, policy):
    """Evaluate explicit pass and improvement conditions, including dead bands."""
    passed, target, reason = _condition(observed, targets, policy.get('passCondition') or {})
    if reason:
        return None, target, reason
    improvement = policy.get('improvementCondition')
    if isinstance(improvement, dict) and improvement.get('kind') == 'COMPLEMENT_OF_PASS':
        needs_improvement = not passed
    elif improvement:
        needs_improvement, _, reason = _condition(observed, targets, improvement)
        if reason:
            return None, target, reason
    else:
        needs_improvement = False
    if passed and needs_improvement:
        return None, target, 'OVERLAPPING_APPROVED_CONDITIONS'
    if passed:
        return 'MEETS_CRITERION', target, None
    if needs_improvement:
        return 'NEEDS_IMPROVEMENT', target, None
    return None, target, 'NO_APPROVED_IMPROVEMENT_CONDITION' if not improvement else 'OUTSIDE_APPROVED_DECISION_REGIONS'


def corrective_feedback(criterion, row, target, status):
    advice = criterion.get('correctionAdvice') or {}
    if isinstance(advice, str):
        advice = {'adjustments': [advice]}
    return {'issue': criterion.get('description'), 'bodyPart': criterion.get('bodyPart'),
            'repNumber': row.get('repNumber'), 'timestampSeconds': row.get('timestampSeconds'),
            'observedValue': row.get('observedValue'), 'targetValue': target,
            'reason': 'Số đo nằm ngoài điều kiện đã duyệt.' if status == 'NEEDS_IMPROVEMENT' else 'Số đo nằm trong điều kiện đã duyệt.',
            'adjustments': advice.get('adjustments', []),
            'retry': advice.get('retry', 'Quay lại cùng biến thể và góc camera để đối chiếu.'),
            'coachReview': advice.get('coachReview', 'Nhờ Coach xem lại nếu dấu hiệu lặp lại hoặc bạn khó kiểm soát chuyển động.'),
            'source': criterion.get('referenceSources', [])}
