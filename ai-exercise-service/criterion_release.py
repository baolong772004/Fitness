"""Explicit, evidence-checked release of one Coach-signed criterion.

No release is created by an analysis, a Coach label, or a content review alone.
The runtime continues to recheck the hash-bound holdout report on every use.
"""
from copy import deepcopy
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile

import standard_registry as registry
from criterion_evaluation import reference_digest, released_policy

SERVICE_ROOT = Path(__file__).resolve().parent
SHA256 = re.compile(r'^[a-f0-9]{64}$')


def _base_standard(exercise, variant):
    index = json.loads((registry.ROOT / 'index.json').read_text(encoding='utf-8'))
    matches = [item for item in index['standards']
               if item['exerciseId'] == exercise and item['exerciseVariant'] == variant]
    if len(matches) != 1:
        raise ValueError('UNKNOWN_STANDARD_OR_VARIANT')
    path = (registry.ROOT / matches[0]['path']).resolve()
    if not path.is_relative_to(registry.ROOT.resolve()) or path.suffix != '.json':
        raise ValueError('INVALID_STANDARD_PATH')
    return registry.validate_standard(json.loads(path.read_text(encoding='utf-8')))


def _timestamp(value):
    try:
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (AttributeError, ValueError):
        raise ValueError('SIGNED_AT_WITH_TIMEZONE_REQUIRED') from None
    if stamp.tzinfo is None:
        raise ValueError('SIGNED_AT_WITH_TIMEZONE_REQUIRED')
    return stamp


def prepare_release(exercise, payload, report_root=SERVICE_ROOT):
    """Return a prospective standard only if the real release gate accepts it."""
    if not isinstance(payload, dict):
        raise ValueError('INVALID_RELEASE_REQUEST')
    variant = payload.get('exerciseVariant')
    criterion_id = payload.get('criterionId')
    current = registry.load_standard(exercise, variant)
    if (payload.get('standardVersion') != current['standardVersion']
            or payload.get('standardDigest') != registry.standard_digest(current)):
        raise ValueError('STANDARD_CHANGED_SINCE_COACH_REVIEW')
    criterion = next((item for item in current['criteria'] if item['criterionId'] == criterion_id), None)
    if not criterion or criterion['type'] == 'D':
        raise ValueError('UNSUPPORTED_CRITERION')
    if criterion['evaluationPolicy']['status'] == 'APPROVED_AND_VALIDATED':
        raise ValueError('CRITERION_ALREADY_RELEASED')
    reviewer = payload.get('reviewer')
    if not isinstance(reviewer, dict) or not all(reviewer.get(k) for k in ('reviewerId', 'qualification', 'reviewRecordId', 'reviewedAt')):
        raise ValueError('COACH_SIGNED_REVIEW_REQUIRED')
    _timestamp(reviewer['reviewedAt'])
    signed_at = payload.get('signedAt')
    _timestamp(signed_at)
    signature = payload.get('approvalSignatureSha256')
    if not SHA256.fullmatch(str(signature)):
        raise ValueError('APPROVAL_SIGNATURE_REQUIRED')
    conditions = payload.get('conditions')
    if not isinstance(conditions, dict) or not conditions.get('passCondition') or not conditions.get('improvementCondition'):
        raise ValueError('COACH_APPROVED_DECISION_CONDITIONS_REQUIRED')
    artifact = payload.get('validationReport')
    if not isinstance(artifact, dict) or not all(artifact.get(k) for k in
            ('path', 'sha256', 'standardVersion', 'criterionId', 'scope', 'acceptanceCriteriaId')):
        raise ValueError('VALIDATION_REPORT_REQUIRED')
    if not SHA256.fullmatch(str(artifact['sha256'])):
        raise ValueError('INVALID_REPORT_SHA256')
    report_path = (Path(report_root) / artifact['path']).resolve()
    private_root = (Path(report_root) / 'evaluation' / 'private').resolve()
    if not report_path.is_relative_to(private_root) or report_path.suffix != '.json':
        raise ValueError('REPORT_MUST_BE_IN_PRIVATE_EVALUATION_DIRECTORY')
    if artifact['criterionId'] != criterion_id or artifact['standardVersion'] != current['standardVersion']:
        raise ValueError('REPORT_CRITERION_OR_VERSION_MISMATCH')
    scope = artifact['scope']
    if (not isinstance(scope, dict) or scope.get('exerciseVariant') != variant
            or not scope.get('modelVersion') or not scope.get('ruleVersion')
            or not isinstance(scope.get('cameraViews'), list) or not scope['cameraViews']
            or not set(scope['cameraViews']).issubset(set(criterion['requiredCameraAngles']))):
        raise ValueError('INVALID_RELEASE_SCOPE')
    candidate = deepcopy(current)
    candidate['approvedByCoach'] = reviewer
    candidate['approvedAt'] = signed_at
    candidate_criterion = next(item for item in candidate['criteria'] if item['criterionId'] == criterion_id)
    policy = candidate_criterion['evaluationPolicy']
    policy.update(status='APPROVED_AND_VALIDATED',
                  passCondition=conditions['passCondition'],
                  improvementCondition=conditions['improvementCondition'],
                  approvedByCoach={**reviewer, 'approvalSignatureSha256': signature},
                  approvedAt=signed_at,
                  validationReport=artifact)
    policy['approvedStandardDigest'] = reference_digest(candidate)
    registry.validate_standard(candidate)
    released, blocker = released_policy(candidate, candidate_criterion, report_root=report_root)
    if released is None:
        raise ValueError(blocker or 'VALIDATION_NOT_ACCEPTED')
    return candidate


def commit_release(exercise, payload, report_root=SERVICE_ROOT):
    candidate = prepare_release(exercise, payload, report_root)
    base = _base_standard(candidate['exerciseId'], candidate['exerciseVariant'])
    destination = registry.ACTIVE_ROOT / f"{candidate['exerciseId'].lower()}-{candidate['exerciseVariant'].lower()}.json"
    registry.ACTIVE_ROOT.mkdir(parents=True, exist_ok=True)
    content = {'baseStandardDigest': registry.standard_digest(base), 'standard': candidate}
    raw = json.dumps(content, ensure_ascii=False, indent=2, allow_nan=False).encode('utf-8')
    fd, temp_name = tempfile.mkstemp(prefix='.release-', suffix='.json', dir=registry.ACTIVE_ROOT)
    try:
        with os.fdopen(fd, 'wb') as target:
            target.write(raw)
            target.flush()
            os.fsync(target.fileno())
        os.replace(temp_name, destination)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
    return {'criterionId': payload['criterionId'], 'standardVersion': candidate['standardVersion'],
            'releasedStandardDigest': registry.standard_digest(candidate),
            'releaseFileSha256': hashlib.sha256(raw).hexdigest(), 'status': 'APPROVED_AND_VALIDATED'}
