"""Projected measurements independent of targets, approval, and technique verdicts."""
from math import hypot

from diagnostics import landmark_problem, value_range
from rules import angle

MIN_SAMPLES = 8
VISIBILITY = .65


def _point(frame, name, width, height):
    point = frame.get('landmarks', {}).get(name)
    if landmark_problem(point, VISIBILITY):
        return None
    return point['x'] * width, point['y'] * height


def _metric(frame, side, definition, width, height):
    names = [side + joint for joint in definition['joints']]
    points = [_point(frame, name, width, height) for name in names]
    if any(point is None for point in points):
        return None
    source = definition['source']
    if source == 'angle':
        value = angle(*points)
        unit = 'degrees'
    elif source == 'wrist_height':
        shoulder, hip, wrist = points
        torso = hypot(shoulder[0] - hip[0], shoulder[1] - hip[1])
        if torso < height * .04:
            return None
        value = (shoulder[1] - wrist[1]) / torso
        unit = 'torso_lengths'
    elif source == 'hip_line':
        shoulder, hip, ankle = points
        length = hypot(shoulder[0] - ankle[0], shoulder[1] - ankle[1])
        if length < height * .08:
            return None
        value = ((ankle[0] - shoulder[0]) * (shoulder[1] - hip[1])
                 - (ankle[1] - shoulder[1]) * (shoulder[0] - hip[0])) / (length * length)
        unit = 'body_lengths'
    else:
        raise ValueError('Unsupported measurement source')
    return {'timeSeconds': frame['timeSeconds'], 'value': round(value, 3),
            'side': side.upper(), 'joints': {name: {'x': frame['landmarks'][name]['x'],
                                                   'y': frame['landmarks'][name]['y'],
                                                   'visibility': frame['landmarks'][name]['visibility']}
                                            for name in names}, 'unit': unit}


def measure_projected_joints(frames, definition, width, height):
    by_side = {side: [item for frame in frames if (item := _metric(frame, side, definition, width, height))]
               for side in ('left', 'right')}
    side = max(by_side, key=lambda key: len(by_side[key]))
    values = by_side[side]
    if len(values) < MIN_SAMPLES:
        return None, 'MISSING_LANDMARKS'
    low = min(values, key=lambda item: item['value'])
    high = max(values, key=lambda item: item['value'])
    return {'sampleCount': len(values), 'side': side.upper(), 'unit': values[0]['unit'],
            'range': value_range(item['value'] for item in values),
            'minimum': low, 'maximum': high}, None

