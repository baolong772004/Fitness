"""Versioned, configurable observation thresholds; none are safety limits."""
from dataclasses import asdict, dataclass, fields
import hashlib
import json
import math
import os
from pathlib import Path


@dataclass(frozen=True)
class SquatConfig:
    standing_angle: float = 155.0
    onset_degrees: float = 8.0
    minimum_rom: float = 35.0
    minimum_rep_seconds: float = 0.6
    comparison_rom_ratio: float = 0.7
    comparison_torso_degrees: float = 12.0
    comparison_tempo_ratio: float = 1.6
    comparison_knee_travel_ratio: float = 0.2
    sample_hz: float = 10.0
    visibility: float = 0.65
    usable_fraction: float = 0.65  # Legacy config accepted; v5+ uses per-repetition coverage.
    view_fraction: float = 0.75
    side_shoulder_ratio: float = 0.55
    side_hip_ratio: float = 0.45
    front_shoulder_ratio: float = 0.70
    front_hip_ratio: float = 0.35
    max_gap_seconds: float = 0.31
    sustain_seconds: float = 0.25
    min_rep_coverage: float = 0.80
    foot_drift_ratio: float = 0.12
    max_scale_change: float = 0.20
    depth_tolerance_ratio: float = 0.12
    torso_increase_degrees: float = 12.0
    hip_shoulder_rise_ratio: float = 0.12
    knee_inward_ratio: float = 0.10
    tempo_tolerance_seconds: float = 0.30
    front_onset_ratio: float = 0.10
    front_peak_ratio: float = 0.20
    front_return_ratio: float = 0.05
    front_calibration_seconds: float = 0.50

    def __post_init__(self):
        for key, value in asdict(self).items():
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
                raise ValueError(f'Invalid positive threshold: {key}')
        for key in ('visibility', 'usable_fraction', 'view_fraction', 'min_rep_coverage', 'max_scale_change'):
            if getattr(self, key) > 1:
                raise ValueError(f'{key} must be <= 1')
        if not 5 <= self.sample_hz <= 15 or self.side_shoulder_ratio >= self.front_shoulder_ratio:
            raise ValueError('Invalid sampling rate or overlapping view bands')
        if not self.front_return_ratio < self.front_onset_ratio < self.front_peak_ratio:
            raise ValueError('Invalid front segmentation hysteresis')

    def snapshot(self):
        values = asdict(self)
        digest = hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()[:12]
        return {'id': f'squat-v6-{digest}', 'values': values, 'validation': 'PROVISIONAL_NOT_COACH_VALIDATED'}


def load_config():
    filename = os.environ.get('SQUAT_CONFIG_PATH')
    if not filename:
        return SquatConfig()
    values = json.loads(Path(filename).read_text(encoding='utf-8'))
    if not isinstance(values, dict) or set(values) - {f.name for f in fields(SquatConfig)}:
        raise ValueError('Unknown Squat threshold configuration')
    return SquatConfig(**values)


def parse_protocol(value=None):
    value = {} if value is None else value
    if not isinstance(value, dict) or set(value) - {'cameraView', 'depthTarget', 'descentTargetSeconds'}:
        raise ValueError('Unsupported analysis options')
    view = value.get('cameraView', 'AUTO')
    depth = value.get('depthTarget', 'NONE')
    tempo = value.get('descentTargetSeconds')
    if view not in ('AUTO', 'SIDE', 'FRONT') or depth not in ('NONE', 'HIP_AT_KNEE'):
        raise ValueError('Invalid view or depth target')
    if tempo is not None and (isinstance(tempo, bool) or not isinstance(tempo, (int, float)) or not math.isfinite(tempo) or not 1 <= tempo <= 6):
        raise ValueError('Descent target must be between 1 and 6 seconds')
    return {'cameraView': view, 'depthTarget': depth, 'descentTargetSeconds': tempo}
