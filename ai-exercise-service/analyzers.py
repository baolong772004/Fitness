"""Movement plugin boundary; capability states describe actual implementation."""
from dataclasses import dataclass
from typing import Protocol

from diagnostics import pose_diagnostics
from exercise_catalog import EXERCISES
from squat_criteria import analyze_pose_frames
from technique_engine import measured_pose_result


class ExerciseAnalyzer(Protocol):
    def analyze(self, frames, width, height, protocol, config, diagnostics): ...


@dataclass(frozen=True)
class SquatAnalyzer:
    def analyze(self, frames, width, height, protocol, config, diagnostics):
        result = analyze_pose_frames(frames, width, height, protocol, config, diagnostics)
        result['analyzerCapabilities'] = {'movementSegmentation': 'IMPLEMENTED_EXPERIMENTAL',
                                          'techniqueEvaluation': 'REQUIRES_APPROVED_CRITERION',
                                          'phase': 'REPETITIONS'}
        return result


@dataclass(frozen=True)
class ProjectedMeasurementAnalyzer:
    exercise: str

    def analyze(self, frames, width, height, protocol, config, diagnostics):
        # These plugins have real exercise-specific feature extractors in the
        # measurement engine. They are explicitly not supported rep analyzers.
        result = measured_pose_result(self.exercise, frames, protocol['cameraView'])
        result['protocol'] = protocol
        diagnostics.update(pose_diagnostics(frames, width, height, config))
        result['analyzerCapabilities'] = {'movementSegmentation': 'NOT_IMPLEMENTED',
                                          'techniqueEvaluation': 'NOT_SUPPORTED',
                                          'phase': EXERCISES[self.exercise]['phase']}
        return result


def analyzer_for(exercise):
    if exercise == 'SQUAT':
        return SquatAnalyzer()
    if exercise in EXERCISES:
        return ProjectedMeasurementAnalyzer(exercise)
    raise ValueError('Unsupported exercise')
