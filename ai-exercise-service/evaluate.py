"""Evaluate only explicitly Coach-confirmed, real, held-out footage.

Never manufactures labels. Run: python evaluate.py --manifest evaluation/manifest.json
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from collections import defaultdict
from time import perf_counter
from squat_config import parse_protocol

SIGNALS = ['DEPTH_TARGET', 'TORSO_ASCENT_CHANGE', 'DESCENT_TARGET', 'KNEE_INWARD_LEFT', 'KNEE_INWARD_RIGHT', 'VARIABLE_ROM', 'INCREASING_TORSO_LEAN', 'VARIABLE_TEMPO', 'VARIABLE_KNEE_TRAVEL']


def validate_labels(labels):
    if not isinstance(labels,dict):
        raise ValueError('Nhãn phải là JSON object.')
    if labels.get('schemaVersion') != 1 or labels.get('coachConfirmed') is not True or not str(labels.get('reviewer','')).strip() or not labels.get('reviewedAt'):
        raise ValueError('Chưa có xác nhận, tên người đánh giá hoặc ngày đánh giá của Coach.')
    if labels.get('sourceType') != 'REAL':
        raise ValueError('Không dùng video dựng/synthetic để báo độ chính xác kỹ thuật.')
    if labels.get('expectedStatus') not in ('ANALYZABLE','INSUFFICIENT_DATA','NON_SQUAT'):
        raise ValueError('Thiếu nhãn khả năng đánh giá video.')
    if labels.get('cameraView') not in ('SIDE','FRONT','OBLIQUE','UNKNOWN'):
        raise ValueError('Thiếu góc quay được Coach xác nhận.')
    if not isinstance(labels.get('protocol'),dict):
        raise ValueError('Thiếu mục tiêu phân tích đã chọn trước lần tập.')
    parse_protocol(labels['protocol'])
    reps = labels.get('repetitions')
    if not isinstance(reps,list) or type(labels.get('repCount')) is not int or labels.get('repCount') != len(reps):
        raise ValueError('Số rep phải khớp danh sách rep hoàn chỉnh do Coach xác nhận.')
    previous = -1
    for rep in reps:
        start,bottom,end = (rep.get(k) for k in ('startSeconds','bottomSeconds','endSeconds'))
        if not all(isinstance(v,(float,int)) and not isinstance(v,bool) and math.isfinite(v) for v in (start,bottom,end)) or not 0 <= start < bottom < end or start < previous:
            raise ValueError('Mốc rep không hợp lệ hoặc chồng lấn.')
        previous = end
        annotations = rep.get('signals',{})
        if set(annotations) != set(SIGNALS):
            raise ValueError('Mỗi rep cần đánh dấu PRESENT/ABSENT/UNASSESSABLE cho đủ tiêu chí.')
        for code,item in annotations.items():
            if item.get('outcome') not in ('PRESENT','ABSENT','UNASSESSABLE'):
                raise ValueError(f'Nhãn không hợp lệ: {code}')
            timestamp = item.get('timestampSeconds')
            if item['outcome']=='PRESENT' and (not isinstance(timestamp,(int,float)) or isinstance(timestamp,bool) or not math.isfinite(timestamp) or not start <= timestamp <= end):
                raise ValueError('Dấu hiệu PRESENT cần timestamp trong rep.')
    if labels['expectedStatus'] == 'ANALYZABLE' and not reps:
        raise ValueError('Video ANALYZABLE cần ít nhất một rep hoàn chỉnh.')


def temporal_iou(a,b):
    overlap=max(0,min(a['endSeconds'],b['endSeconds'])-max(a['startSeconds'],b['startSeconds']))
    union=max(a['endSeconds'],b['endSeconds'])-min(a['startSeconds'],b['startSeconds'])
    return overlap/union if union>0 else 0


def match_reps(expected,predicted,threshold=.5):
    # One-to-one temporal matching: extra detections cannot match the same true rep twice.
    candidates=sorted([(temporal_iou(a,b),i,j) for i,a in enumerate(expected) for j,b in enumerate(predicted)],reverse=True)
    pairs={}; used=set()
    for score,i,j in candidates:
        if score>=threshold and i not in pairs and j not in used:
            pairs[i]=j; used.add(j)
    return pairs,used


def score_clip(labels,result):
    expected,predicted=labels['repetitions'],result.get('repetitions',[])
    pairs,used=match_reps(expected,predicted)
    counts={code:{'tp':0,'fp':0,'fn':0,'tn':0,'abstained':0,'unassessableGroundTruth':0} for code in SIGNALS}
    timing=[]
    for i,gt in enumerate(expected):
        pred=predicted[pairs[i]] if i in pairs else None
        obs={o['code']:o for o in pred.get('observations',[])} if pred else {}
        checked={c['code']:c for c in pred.get('criteria',[])} if pred else {}
        comparison_map={'VARIABLE_ROM':'DEPTH_CONSISTENCY','INCREASING_TORSO_LEAN':'TORSO_LEAN_CHANGE','VARIABLE_TEMPO':'TEMPO_CONSISTENCY','VARIABLE_KNEE_TRAVEL':'KNEE_TRAVEL_CONSISTENCY'}
        global_checks={c['code']:c for c in result.get('criteria',[])}
        for code in SIGNALS:
            label=gt['signals'][code]; c=counts[code]
            if label['outcome']=='UNASSESSABLE':
                c['unassessableGroundTruth']+=1
                continue
            present=code in obs
            assessed=present or checked.get(code,{}).get('status')=='ASSESSED' or (pred is not None and code in comparison_map and global_checks.get(comparison_map[code],{}).get('status')=='ASSESSED')
            if not assessed:
                c['abstained']+=1
            if label['outcome']=='PRESENT':
                c['tp' if present else 'fn']+=1  # Missed positives include abstentions.
                if present:
                    timing.append(abs(obs[code]['timestampSeconds']-label['timestampSeconds']))
            elif present:
                c['fp']+=1
            elif assessed:
                c['tn']+=1
    for j,rep in enumerate(predicted):
        if j not in used:
            for code in {o['code'] for o in rep.get('observations',[]) if o['code'] in counts}:
                counts[code]['fp']+=1
    actual_count=labels['repCount']
    prediction_count=result.get('detectedRepetitions') or 0
    return {'counts':counts,'absoluteRepCountError':abs(actual_count-prediction_count),'signedRepCountError':prediction_count-actual_count,'matchedReps':len(pairs),'missedReps':len(expected)-len(pairs),'extraReps':len(predicted)-len(used),'timestampErrorsSeconds':timing,'insufficient':result['status'] in ('INSUFFICIENT_DATA','NEEDS_REVIEW'),'falseAcceptance':labels['expectedStatus']!='ANALYZABLE' and result['status']=='COMPLETED'}


def aggregate(rows):
    if not rows:
        return {'precision':None,'recall':None,'repCountMAE':None,'insufficientDataRate':None,'evaluatedClips':0,'byCriterion':{}}
    counts={code:defaultdict(int) for code in SIGNALS}
    for row in rows:
        for code,values in row['score']['counts'].items():
            for key,n in values.items(): counts[code][key]+=n
    def metrics(c):
        # Abstentions on positive GT are already included in FN; do not count twice.
        return {**c,'precision':c['tp']/(c['tp']+c['fp']) if c['tp']+c['fp'] else None,'recall':c['tp']/(c['tp']+c['fn']) if c['tp']+c['fn'] else None}
    total={key:sum(c[key] for c in counts.values()) for key in ('tp','fp','fn','tn','abstained','unassessableGroundTruth')}
    times=[t for r in rows for t in r['score']['timestampErrorsSeconds']]
    return {**metrics(total),'evaluatedClips':len(rows),'repCountMAE':sum(r['score']['absoluteRepCountError'] for r in rows)/len(rows),'insufficientDataRate':sum(r['score']['insufficient'] for r in rows)/len(rows),'falseAcceptanceCount':sum(r['score']['falseAcceptance'] for r in rows),'timestampMAESeconds':sum(times)/len(times) if times else None,'byCriterion':{code:metrics(c) for code,c in counts.items()}}


def evaluate_manifest(manifest_path):
    manifest_path=Path(manifest_path).resolve()
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    rows,excluded,seen=[],[],set()
    for clip in manifest.get('clips',[]):
        try:
            if clip.get('split')!='holdout' or clip.get('sourceType')!='REAL':
                raise ValueError('Chỉ tính độ chính xác trên video thật thuộc tập holdout.')
            video=(manifest_path.parent/clip['video']).resolve()
            label_path=(manifest_path.parent/clip['labels']).resolve()
            labels=json.loads(label_path.read_text(encoding='utf-8'))
            validate_labels(labels)
            digest=hashlib.sha256(video.read_bytes()).hexdigest()
            if digest!=labels.get('videoSha256'):
                raise ValueError('Nhãn và video không khớp SHA-256.')
            if digest in seen:
                raise ValueError('Video trùng nội dung trong bộ đánh giá.')
            seen.add(digest)
            from main import analyze_video
            start=perf_counter()
            result=analyze_video(str(video),labels.get('protocol'))
            rows.append({'video':clip['video'],'cameraView':labels.get('cameraView','UNKNOWN'),'ruleVersion':result.get('ruleVersion'),'modelVersion':result.get('modelVersion'),'thresholdConfigId':result.get('thresholdConfig',{}).get('id'),'processingSeconds':round(perf_counter()-start,3),'expectedRepCount':labels['repCount'],'detectedRepCount':result.get('detectedRepetitions'),'status':result['status'],'score':score_clip(labels,result)})
        except (ValueError,KeyError,OSError) as error:
            excluded.append({'video':clip.get('video'),'reason':str(error)})
    return {'status':'EVALUATED' if rows else 'INSUFFICIENT_GROUND_TRUTH','claim':'CHƯA ĐỦ BẰNG CHỨNG VỀ ĐỘ CHÍNH XÁC' if not rows else 'Metrics apply only to this declared Coach-confirmed held-out set; report sample size and subgroup coverage.','matching':'one-to-one temporal IoU >= 0.5; per-rep binary signals; positive abstentions count as false negatives; unassessable labels excluded; insufficient output counts as zero reps','metrics':aggregate(rows),'byView':{view:aggregate([r for r in rows if r['cameraView']==view]) for view in sorted({r['cameraView'] for r in rows})},'clips':rows,'excluded':excluded}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--manifest',default='evaluation/manifest.json')
    parser.add_argument('--output',default='evaluation/report.json')
    args=parser.parse_args()
    report=evaluate_manifest(args.manifest)
    output=Path(args.output); output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'status':report['status'],'metrics':report['metrics']},ensure_ascii=False))
