"""Auditable measurements; diagnostic angles are 2D projections, not form labels."""
from collections import Counter
from math import isfinite


def landmark_problem(p, visibility):
    if not p:
        return 'MISSING'
    if not all(isinstance(p.get(k), (int, float)) and isfinite(p[k]) for k in ('x', 'y', 'visibility')):
        return 'NON_FINITE'
    if p['visibility'] < visibility:
        return 'LOW_VISIBILITY'
    if not 0 <= p['x'] <= 1 or not 0 <= p['y'] <= 1:
        return 'OUT_OF_FRAME'
    return None


def value_range(values):
    values = [v for v in values if v is not None and isfinite(v)]
    return {'count':len(values), 'min':round(min(values),3) if values else None,
            'max':round(max(values),3) if values else None,
            'range':round(max(values)-min(values),3) if values else None}


def pose_diagnostics(frames, width, height, cfg):
    from rules import angle
    timeline, rejected = [], Counter()
    for f in frames:
        row = {'timeSeconds':f['timeSeconds'], 'missingLandmarks':{}}
        for side in ('left', 'right'):
            names = [side+j for j in ('Shoulder','Hip','Knee','Ankle')]
            points = []
            for name in names:
                p = f['landmarks'].get(name)
                problem = landmark_problem(p,cfg.visibility)
                if problem:
                    row['missingLandmarks'][name]=problem
                    rejected[name+':'+problem]+=1
                else:
                    points.append((p['x']*width,p['y']*height))
            row[side+'CoreValid']=len(points)==4
            row[side+'KneeAngle']=angle(*points[1:]) if len(points)==4 else None
            row[side+'HipAngle']=angle(*points[:3]) if len(points)==4 else None
            for joint in ('Heel','Toe'):
                name=side+joint
                problem=landmark_problem(f['landmarks'].get(name),cfg.visibility)
                if problem:
                    row['missingLandmarks'][name]=problem
                    rejected[name+':'+problem]+=1
        timeline.append(row)
    totals = {s:sum(r[s+'CoreValid'] for r in timeline) for s in ('left','right')}
    totals['bilateral']=sum(r['leftCoreValid'] and r['rightCoreValid'] for r in timeline)
    return {'timeline':timeline, 'landmarks':{'poseFrames':len(frames),'coreValidFrames':totals,
             'coreValidRatesAmongPoseFrames':{s:round(n/len(frames),4) if frames else 0 for s,n in totals.items()},
             'rejectionsByLandmark':dict(rejected)},
            'kinematics':{s+j:value_range(r[s+j] for r in timeline) for s in ('left','right') for j in ('KneeAngle','HipAngle')}}


def state_event(diag, time, state, reason=None):
    if diag is None:
        return
    transitions=diag.setdefault('transitions',[])
    if not transitions or transitions[-1]['state']!=state or reason:
        transitions.append({'timeSeconds':round(time,3),'state':state,'reason':reason})
    diag['transitionCount']=max(0,len(transitions)-1)


class FrameClock:
    """Prefer decoded PTS; explicitly account for invalid/non-monotonic backends."""
    def __init__(self, fps):
        self.fps=fps
        self.previous=None
        self.fallbacks=0

    def seconds(self, index, position_ms):
        t=position_ms/1000
        if not isfinite(t) or t<0 or (self.previous is not None and t<=self.previous):
            t=max(index/self.fps, (self.previous+1/self.fps) if self.previous is not None else 0)
            self.fallbacks+=1
        self.previous=t
        return t


def finalize_diagnostics(result, diag):
    segmentation=diag.setdefault('segmentation',{})
    segmentation.setdefault('transitions',[])
    segmentation.setdefault('transitionCount',0)
    segmentation['completedRepetitions']=len(result.get('repetitions',[]))
    if segmentation.get('signal'):
        segmentation['rawRange']=value_range(r['raw'] for r in segmentation['signal'])
        segmentation['smoothedRange']=value_range(r['smoothed'] for r in segmentation['signal'])
    diag['rejection'] = None if result['status']=='COMPLETED' else {
        'code':segmentation.get('rejectionCode','INSUFFICIENT_INPUT'),
        'message':result['limitations'][0] if result.get('limitations') else 'Chưa đủ dữ liệu.'}
    diag['criteria']=[{k:c.get(k) for k in ('code','status','outcome','reasonCode','reason','requirements')} for c in result.get('criteria',[])]
    sampled=diag.get('pose',{}).get('sampledFrames',0)
    if sampled and 'landmarks' in diag:
        diag['landmarks']['geometryValidRateAmongSampledFrames']=round(diag['landmarks'].get('geometryValidFrames',0)/sampled,4)
    result['diagnostics']=diag
    return result
