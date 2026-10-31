"""Sequential decoding avoids seeking to repeated frames while inventing timestamps."""
import cv2
from diagnostics import FrameClock


def sampled_frames(capture, fps, sample_hz, diag):
    clock=FrameClock(fps)
    next_sample=0.0
    index=0
    diag['decodeTimeline']=[]
    video=diag['video']
    video.update(decodedFrames=0,timestampFallbacks=0,decodeEndedEarly=False)
    while True:
        ok,frame=capture.read()
        if not ok:
            break
        source_ms=capture.get(cv2.CAP_PROP_POS_MSEC)
        seconds=clock.seconds(index,source_ms)
        video['decodedFrames']=index+1
        video['lastDecodedSeconds']=round(seconds,6)
        video['timestampFallbacks']=clock.fallbacks
        if seconds>30:
            video['durationExceeded']=True
            break
        if seconds+1e-7>=next_sample:
            entry={'sourceFrame':index,'sourceTimestampMs':source_ms,'timeSeconds':round(seconds,3),'rejection':None}
            diag['decodeTimeline'].append(entry)
            yield seconds,frame,entry
            next_sample=(int((seconds+1e-7)*sample_hz)+1)/sample_hz
        index+=1
    video['decodeEndedEarly']=video['decodedFrames']+1<video.get('reportedFrameCount',0)
    video['timestampPolicy']='decoded_PTS_with_reported_FPS_fallback'
