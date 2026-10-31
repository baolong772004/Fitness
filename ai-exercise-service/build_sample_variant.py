import cv2
from pathlib import Path

# Deliberately edited/reversed footage to exercise the rules, not a real labeled mistake.
source = Path('samples/github-side-squat.mp4')
out = Path('samples/squat-variable-depth-test.mp4')
cap = cv2.VideoCapture(str(source))
if not cap.isOpened():
    raise FileNotFoundError(source)
fps = cap.get(cv2.CAP_PROP_FPS)
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
writer = cv2.VideoWriter(str(out), cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
if not writer.isOpened():
    cap.release()
    raise RuntimeError('Could not create the sample variant')

def frame_at(index):
    cap.set(cv2.CAP_PROP_POS_FRAMES, index)
    ok, frame = cap.read()
    if not ok:
        raise RuntimeError(f'Could not read frame {index}')
    return frame

def frames(start, end, reverse=False):
    first, last = round(start * fps), round(end * fps)
    return range(last, first - 1, -1) if reverse else range(first, last + 1)

try:
    for index in frames(7.8, 11.8):
        writer.write(frame_at(index))
    for index in frames(14.6, 15.8):
        writer.write(frame_at(index))
    for index in frames(14.6, 15.8, reverse=True):
        writer.write(frame_at(index))
    for index in frames(15.0, 15.7):
        writer.write(frame_at(index))
finally:
    writer.release()
    cap.release()
print(out, out.stat().st_size)
