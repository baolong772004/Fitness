"""Reproducible source-informed drafts; refuses to overwrite existing versions.

Run only when authoring a new version. All policies are experimental and require
qualified human review plus independent video validation before activation.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATE = '2026-10-31'


def source(key, title, url, publisher, summary, scope='EXERCISE_COACHING_REFERENCE'):
    return {'sourceId': key, 'title': title, 'url': url, 'publisher': publisher,
            'accessedAt': DATE, 'summary': summary, 'scope': scope,
            'providesValidatedComputerVisionThresholds': False}


POSE = source('MEDIAPIPE_POSE', 'Pose landmark detection guide',
              'https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker',
              'Google AI Edge', 'Pose Landmarker dự đoán vị trí khớp theo ảnh/video; output không tự xác nhận kỹ thuật hay lực lên khớp.',
              'MEASUREMENT_TECHNOLOGY_NOT_TECHNIQUE_STANDARD')
SQUAT = source('ACE_BODYWEIGHT_SQUAT', 'ACE Bodyweight Squat',
               'https://www.acefitness.org/resources/everyone/exercise-library/135/bodyweight-squat/', 'American Council on Exercise',
               'Hướng dẫn mô tả đứng, hạ người và trở lại đứng; theo dõi bàn chân, hướng gối và phối hợp hông–thân. Mức xuống cần cân nhắc khả năng giữ tư thế.')
NSCA = source('NSCA_SQUAT_CONTEXT', 'NSCA Bridge: Optimizing Squat Technique',
              'https://www.nsca.com/education/videos/bridge-series/bridge-optimizing-squat-technique/', 'National Strength and Conditioning Association',
              'Nguồn trình bày các gợi ý huấn luyện về thế đứng, gót, đầu và độ sâu squat; không cung cấp ngưỡng phân loại lỗi từ video 2D.')
PUSH = source('ACE_PUSH_UP', 'ACE Push-up',
              'https://www.acefitness.org/resources/everyone/exercise-library/41/push-up/', 'American Council on Exercise',
              'Tham chiếu mô tả hạ và đẩy người trong khi kiểm soát thân; vị trí tay và khuỷu có biến thể. Không chuyển chỉ dẫn định tính thành góc đạt mặc định.')
PLANK = source('ACE_FRONT_PLANK', 'ACE Front Plank',
               'https://www.acefitness.org/resources/everyone/exercise-library/32/front-plank/', 'American Council on Exercise',
               'Tham chiếu giữ thân và chân ổn định, vai đặt trên khuỷu rồi hạ người có kiểm soát. Thời gian giữ và khả năng thực hiện cần phù hợp từng người.')
LUNGE = source('ACE_FORWARD_LUNGE', 'ACE Forward Lunge',
               'https://www.acefitness.org/resources/everyone/exercise-library/94/forward-lunge/', 'American Council on Exercise',
               'Mô tả bước ra trước, hạ hông trong phạm vi thoải mái và trở lại đứng; cần kiểm soát chuyển động thân và chân trụ.')
CURL = source('ACE_HAMMER_CURL', 'ACE Hammer Curl',
              'https://www.acefitness.org/resources/everyone/exercise-library/10/hammer-curl/', 'American Council on Exercise',
              'Bài đứng dùng tay cầm trung tính, gập rồi hạ khuỷu có kiểm soát. Cấu trúc khuỷu và cách cầm có khác biệt; pose không xác định được chắc cách cầm tạ.',
              'STANDING_NEUTRAL_GRIP_CURL_CONTEXT_ONLY')
PRESS = source('ACE_DUMBBELL_PRESS', 'ACE Strength Training Workout for Beginners — Dumbbell Shoulder Press',
               'https://www.acefitness.org/resources/pros/expert-articles/5047/strength-training-workout-for-beginners/', 'American Council on Exercise',
               'Mô tả đưa tạ từ bên đầu lên trên và hạ có kiểm soát; có các cách dùng dụng cụ khác nhau. Hướng dẫn không xác nhận độ chính xác ngưỡng pose.')
PRESS_SEATED = source('ACE_PRESS_VARIANTS', 'ACE Smart Shoulder Solutions',
                      'https://www.acefitness.org/resources/pros/expert-articles/9074/smart-shoulder-solutions-an-evidence-based-approach-to-training-the-deltoids/',
                      'American Council on Exercise', 'Bài viết đề cập biến thể dumbbell press ngồi hoặc đứng và lựa chọn phù hợp khả năng; không đưa quy tắc đạt kỹ thuật chung cho mọi người.')


def criterion(identity, name, category, variant, implementation, old_codes, views, joints,
              formula, units, description, correction, source_ids, target=None,
              unsupported=False, limitation=None):
    condition = {'kind': 'COACH_CONDITION_REQUIRED', 'targetKey': target,
                 'description': 'Chưa có điều kiện định lượng được Coach phê duyệt cho phạm vi sử dụng.'}
    return {
        'criterionId': identity, 'criterionName': name, 'type': category,
        'description': description, 'applicableExerciseVariants': [variant],
        'requiredCameraAngles': views, 'requiredLandmarks': joints,
        'implementationKey': implementation, 'sourceCriterionCodes': old_codes,
        'referenceSourceIds': source_ids,
        'measurementMethod': {'id': implementation, 'formula': formula, 'units': units,
                              'configurationRef': 'measurementConfiguration',
                              'outputIsProjected2D': True},
        'evaluationMethod': {'id': 'COACH_APPROVED_POLICY_WITH_VALIDATION_GATE',
                             'requiresReviewedCriterion': True, 'requiresIndependentVideoValidation': True,
                             'requiresApplicableVariant': True},
        'referenceRangeOrTarget': {'kind': 'INDIVIDUAL_TRAINING_TARGET' if target else 'QUALITATIVE_COACHING_REFERENCE',
                                   'targetKey': target, 'value': None, 'universalNumericRange': None},
        'thresholdSource': 'INDIVIDUAL_TRAINING_TARGET' if target else 'COACH_REVIEW_PENDING',
        'passCondition': condition,
        'improvementCondition': {'kind': 'COACH_CONDITION_REQUIRED', 'description': 'Chỉ so điều kiện đã được duyệt; không suy ra từ absence of signal.'},
        'insufficientDataCondition': [
            'Biến thể không khớp hoặc chưa xác định.', 'Góc quay không phù hợp hay thay đổi.',
            'Thiếu khớp hoặc mất tracking trong pha cần đo.',
            'Thiếu mục tiêu áp dụng hoặc chưa có policy đã duyệt và kiểm chứng.'],
        'evidenceRequirements': {'repOrSegment': True, 'timestampSeconds': True,
                                 'observedValueAndUnits': True, 'targetAndProvenanceWhenUsed': True,
                                 'landmarkCoordinatesAndVisibility': True,
                                 'modelRuleStandardVersions': True},
        'correctionAdvice': {'suggestions': correction,
                             'retry': 'Giữ camera cố định theo góc hỗ trợ và quay lại cùng biến thể để đối chiếu.',
                             'coachReviewWhen': 'Có đau, mất kiểm soát, dấu hiệu lặp lại hoặc cần đổi mục tiêu: dừng và nhờ người chuyên môn xem trực tiếp.',
                             'referenceSourceIds': source_ids,
                             'approvalStatus': 'SOURCE_INFORMED_REVIEW_PENDING'},
        'limitations': limitation or ['Hình chiếu 2D chịu ảnh hưởng phối cảnh, vóc dáng và độ chính xác landmark.',
                                     'Không suy ra lực, kích hoạt cơ, áp lực khớp, chẩn đoán hoặc mức an toàn tuyệt đối.'],
        'validationStatus': 'NOT_SUPPORTED' if unsupported else 'EXPERIMENTAL_NOT_COACH_VALIDATED',
        'evaluationPolicy': {'status': 'NOT_SUPPORTED' if unsupported else 'EXPERIMENTAL',
                             'approvedByCoach': None, 'approvedAt': None,
                             'approvedStandardDigest': None, 'validationReport': None,
                             'passCondition': None, 'improvementCondition': None},
    }


def standard(exercise, name, variant, version, equipment, level, refs, start, phases, criteria):
    return {'schemaVersion': 1, 'exerciseId': exercise, 'exerciseName': name,
            'exerciseVariant': variant, 'equipment': equipment, 'trainingLevel': level,
            'referenceSources': refs + [POSE], 'approvedByCoach': None, 'approvedAt': None,
            'approvedStandardDigest': None, 'standardVersion': version, 'status': 'EXPERIMENTAL',
            'startingPosition': {'reference': start,
                                 'requiredLandmarks': sorted({joint for c in criteria for joint in c['requiredLandmarks']}),
                                 'detectionConditions': ['Nhận diện từ đoạn frame liên tục phù hợp, không chỉ frame đầu.',
                                                        'Tách điều kiện khởi tạo đo với điều kiện kết luận kỹ thuật.']},
            'movementPhases': [{'phaseId': code, 'description': text} for code, text in phases],
            'criteria': criteria,
            'measurementConfiguration': {'source': 'IMPLEMENTATION_CONFIGURATION',
                                         'coordinateSystem': 'NORMALIZED_IMAGE_TO_PIXEL_2D',
                                         'visibilityThreshold': .65, 'sampleRateHz': 10,
                                         'visibilityMeaning': 'landmark visibility, not probability of correct technique',
                                         'version': 'pose-measurement-1'},
            'algorithmThresholds': {'source': 'EXPERIMENTAL_ALGORITHM_CONFIGURATION',
                                     'configurationRef': 'SquatConfig' if exercise == 'SQUAT' else 'exercise-specific measurement adapter',
                                     'scientificallyValidatedTechniqueStandard': False,
                                     'changesRequireRegressionTests': True},
            'individualTrainingTargetSchema': {'source': 'COACH_WORKOUT_PLAN_OR_EXPLICIT_USER_TARGET',
                                                'targetsRequire': ['value', 'units', 'exerciseVariant', 'source', 'configuredBy', 'configuredAt'],
                                                'defaults': None, 'interpretFreeTextNotesAutomatically': False},
            'history': [{'version': version, 'createdAt': DATE, 'status': 'DRAFT',
                          'changeReason': 'First source-informed reference; pending qualified Coach review and labeled-video validation.'}]}


def drafts():
    v = 'BODYWEIGHT'
    squat = [
        criterion('SQUAT-01', 'Chu kỳ Squat hoàn chỉnh', 'A', v, 'completion', ['MOVEMENT_TIMING'], ['SIDE','FRONT','OBLIQUE'],
                  ['hip','knee','ankle'], 'standing -> descent -> bottom -> ascent -> standing; no joining tracking gaps', 'repetitions, seconds',
                  'Đo chu kỳ và mốc từng rep hoàn chỉnh.', ['Thử quay cả lúc bắt đầu và kết thúc tư thế đứng để kiểm tra chu kỳ.'], ['ACE_BODYWEIGHT_SQUAT']),
        criterion('SQUAT-02', 'Độ sâu theo mục tiêu', 'B', v, 'target_depth', ['DEPTH_TARGET'], ['SIDE'],
                  ['hip','knee','ankle'], '(knee_y - hip_y) / projected_femur_length at rep bottom', 'femur_lengths',
                  'Lưu vị trí hông so với gối dù chưa có mục tiêu; chỉ kết luận khi mục tiêu và phương pháp được duyệt.',
                  ['Giảm tốc để kiểm soát biên độ; đối chiếu mục tiêu đã thống nhất trong phạm vi thoải mái.'], ['ACE_BODYWEIGHT_SQUAT'], 'depthTarget'),
        criterion('SQUAT-03', 'Chuyển động tương đối của gối', 'C', v, 'knee_projection', ['KNEE_INWARD_LEFT','KNEE_INWARD_RIGHT'], ['FRONT'],
                  ['leftHip','rightHip','leftKnee','rightKnee','leftAnkle','rightAnkle','leftHeel','rightHeel','leftToe','rightToe'],
                  'signed knee displacement relative to foot reference from standing, normalized by stance width; inspect hip/foot stability', 'stance_widths',
                  'Mô tả hai bên gối và mốc bàn chân; một khoảng cách ngang đơn lẻ không chẩn đoán valgus.',
                  ['Giữ bàn chân ổn định, quay rõ hai chân và nhờ Coach đối chiếu hướng gối với bàn chân.'], ['ACE_BODYWEIGHT_SQUAT']),
        criterion('SQUAT-04', 'Phối hợp hông và thân lúc lên', 'C', v, 'torso_change', ['TORSO_ASCENT_CHANGE'], ['SIDE'],
                  ['shoulder','hip','knee','ankle'], 'lean(t)-lean(bottom); (hipRise-shoulderRise)/projected_torso_length', 'degrees, torso_lengths',
                  'Quan sát thay đổi thân qua pha lên; không đo đường cong cột sống.',
                  ['Thử đứng lên chậm hơn để đối chiếu nhịp nâng vai và hông trên video ngang.'], ['ACE_BODYWEIGHT_SQUAT']),
        criterion('SQUAT-05', 'Nhịp và kiểm soát chuyển động', 'A', v, 'movement_control', ['DESCENT_TARGET','MOVEMENT_TIMING','TEMPO_CONSISTENCY'], ['SIDE','FRONT','OBLIQUE'],
                  ['hip','knee','ankle'], 'bottomTime-startTime; endTime-bottomTime; descriptive within-clip variability', 'seconds',
                  'Đo nhịp xuống/lên và khác biệt giữa rep; không tự coi tốc độ khác là nguy hiểm.',
                  ['Thử nhịp đều để kiểm soát các pha; đối chiếu nhịp riêng nếu Coach đã chọn.'], ['ACE_BODYWEIGHT_SQUAT']),
        criterion('SQUAT-06', 'Hai bên cơ thể trên ảnh', 'C', v, 'symmetry_observation', ['LEFT_RIGHT_SYMMETRY'], ['FRONT'],
                  ['leftHip','rightHip','leftKnee','rightKnee','leftAnkle','rightAnkle'],
                  'bilateral projected displacement/phase timing; camera perspective must be controlled', 'degrees, seconds, normalized_displacement',
                  'Chỉ quan sát hai bên khi đủ khớp và góc quay; chưa có thuật toán kết luận đối xứng kỹ thuật.',
                  ['Quay chính diện, cố định camera; nhờ Coach xem khi hai bên trông khác nhau.'], ['NSCA_SQUAT_CONTEXT'], unsupported=True),
        criterion('SQUAT-07', 'Chuyển động gót và giới hạn tiếp xúc sàn', 'D', v, 'heel_observation', ['HEEL_LIFT'], ['SIDE'],
                  ['heel','toe','ankle'], 'projected heel-toe motion only; floor contact/force is unobserved', 'pixels_or_normalized_displacement',
                  'Thấy landmark gót không xác nhận chạm sàn, lực phân bổ hoặc nhấc gót thật.',
                  ['Quay rõ bàn chân và nhờ Coach kiểm tra trực tiếp khi cần kết luận tiếp xúc sàn.'], ['ACE_BODYWEIGHT_SQUAT'], unsupported=True),
        criterion('SQUAT-08', 'Đối chiếu mục tiêu giáo án', 'B', v, 'target_achievement', ['DESCENT_TARGET','DEPTH_TARGET'], ['SIDE','FRONT'],
                  ['hip','knee','ankle'], 'measured criterion value versus typed Coach target for same exercise/variant', 'target_dependent',
                  'Đối chiếu mục tiêu có nguồn và đơn vị; không parse ghi chú tự do thành ngưỡng tự động.',
                  ['Thử lại cùng góc, biến thể và mục tiêu; trao đổi với Coach khi cần thay mục tiêu.'], ['NSCA_SQUAT_CONTEXT'], 'individualTarget'),
    ]
    out=[standard('SQUAT','Bodyweight Squat',v,'bodyweight-squat-1.0.0-draft',['NONE'],'COACH_ADAPTED', [SQUAT,NSCA],
                  'Đứng với thế chân phù hợp, thấy vai đến bàn chân. Điều kiện phần mềm: khớp chân đủ rõ và có đoạn đứng phù hợp ở bất kỳ lúc nào.',
                  [('PREPARE','Tìm đoạn đứng để làm mốc.'),('DESCENT','Hạ hông và gập gối.'),('BOTTOM','Mốc thấp nhất quan sát được.'),('ASCENT','Duỗi hông/gối để trở lại đứng.'),('FINISH','Xác nhận trở lại mốc đứng.')],squat)]
    definitions=[
        ('PUSH_UP','Push-up','STANDARD','standard-push-up-1.0.0-draft',['NONE'],'COACH_ADAPTED',[PUSH],
         'Thân duỗi trong tư thế chống tay; thấy rõ vai, khuỷu, cổ tay, hông và chân.',
         [('PREPARE','Chuẩn bị chống tay.'),('DESCENT','Gập khuỷu để hạ người.'),('BOTTOM','Mốc dưới theo mục tiêu.'),('ASCENT','Đẩy người lên.'),('FINISH','Trở lại mốc duỗi.')],
         [('PUSHUP-01','Biên độ khuỷu','A','elbow_flexion',['ELBOW_FLEXION'],['Shoulder','Elbow','Wrist'],'angle(shoulder,elbow,wrist)','degrees','Đo góc khuỷu; chưa chứng minh chạm sàn hay rep đạt.',['Quay rõ cả khuỷu và cổ tay để đối chiếu pha hạ/đẩy.']),
          ('PUSHUP-02','Đường thân trên ảnh','C','body_alignment',['BODY_ALIGNMENT'],['Shoulder','Hip','Ankle'],'angle(shoulder,hip,ankle)','degrees','Quan sát thân ở từng pha, không suy ra độ cong lưng.',['Thử giữ thân ổn định, đối chiếu vai–hông–chân trên video ngang.'])]),
        ('PLANK','Front Plank','FRONT','front-plank-1.0.0-draft',['MAT_OPTIONAL'],'COACH_ADAPTED',[PLANK],
         'Chống khuỷu trong biến thể plank trước, thấy vai, khuỷu, hông và cổ chân.',
         [('PREPARE','Vào tư thế chống khuỷu.'),('HOLD','Khoảng giữ liên tục có đủ khớp.'),('FINISH','Hạ người có kiểm soát.')],
         [('PLANK-01','Đường thân trong khoảng giữ','C','body_alignment',['BODY_ALIGNMENT'],['Shoulder','Hip','Ankle'],'angle(shoulder,hip,ankle)','degrees','Đo đường thân qua thời gian, không chẩn đoán võng lưng.',['Giữ camera ngang và khung hình trọn vai đến chân.']),
          ('PLANK-02','Vị trí hông trên ảnh','C','hip_height',['HIP_HEIGHT'],['Shoulder','Hip','Ankle'],'signed hip offset from shoulder-ankle line / projected_body_length','body_lengths','Đo độ lệch hông trên ảnh; góc camera ảnh hưởng độ lệch.',['Thử giữ hông ổn định và nhờ Coach đối chiếu cùng góc quay.'])]),
        ('LUNGE','Forward Bodyweight Lunge','FORWARD_BODYWEIGHT','forward-lunge-1.0.0-draft',['NONE'],'COACH_ADAPTED',[LUNGE],
         'Đứng, chuẩn bị bước ra trước; camera phải thấy cả chân trụ và chân bước.',
         [('PREPARE','Đứng chuẩn bị bước.'),('STEP','Bước ra trước.'),('DESCENT','Hạ người trong phạm vi phù hợp.'),('ASCENT','Đẩy trở lại.'),('FINISH','Trở lại đứng.')],
         [('LUNGE-01','Góc gối quan sát','A','knee_angle',['KNEE_ANGLE'],['Hip','Knee','Ankle'],'angle(hip,knee,ankle)','degrees','Đo bên nhìn rõ; chưa xác nhận chân trước tự động.',['Quay ngang, thấy chân trước và cổ chân xuyên suốt.']),
          ('LUNGE-02','Góc thân quan sát','C','torso_angle',['TORSO_ANGLE'],['Shoulder','Hip','Knee'],'angle(shoulder,hip,knee)','degrees','Đo thay đổi thân; chưa kết luận mất thăng bằng.',['Thử kiểm soát hạ hông và đối chiếu thân theo từng pha.'])]),
        ('BICEPS_CURL','Standing Dumbbell Curl','DUMBBELL_STANDING','standing-dumbbell-curl-1.0.0-draft',['DUMBBELLS'],'COACH_ADAPTED',[CURL],
         'Đứng cầm dumbbell; biến thể cách cầm cần Coach xác nhận riêng vì pose không quan sát chắc lòng bàn tay.',
         [('PREPARE','Tay ở mốc bắt đầu của biến thể.'),('FLEXION','Gập khuỷu.'),('TOP','Mốc trên.'),('EXTENSION','Hạ tay có kiểm soát.'),('FINISH','Trở lại mốc bắt đầu.')],
         [('CURL-01','Biên độ gập khuỷu','A','elbow_flexion',['ELBOW_FLEXION'],['Shoulder','Elbow','Wrist'],'angle(shoulder,elbow,wrist)','degrees','Góc hình chiếu không chứng minh cách cầm tạ.',['Quay đủ tay trên và cổ tay trong toàn chu kỳ.']),
          ('CURL-02','Cánh tay trên so với thân','C','upper_arm_drift',['UPPER_ARM_DRIFT'],['Elbow','Shoulder','Hip'],'angle(elbow,shoulder,hip)','degrees','Đo vị trí cánh tay trên; không áp mốc cố định cho mọi biến thể curl.',['Quay ngang để Coach so vị trí khuỷu theo biến thể đã chọn.'])]),
        ('SHOULDER_PRESS','Seated Dumbbell Shoulder Press','DUMBBELL_SEATED','seated-dumbbell-press-1.0.0-draft',['DUMBBELLS','BENCH'],'COACH_ADAPTED',[PRESS,PRESS_SEATED],
         'Ngồi cầm dumbbell ở vùng vai; giữ cả cổ tay trong ảnh ở vị trí đẩy lên.',
         [('PREPARE','Tạ tại mốc bắt đầu.'),('PRESS','Đẩy lên.'),('TOP','Mốc trên.'),('LOWER','Hạ có kiểm soát.'),('FINISH','Trở lại mốc vai.')],
         [('PRESS-01','Góc duỗi khuỷu','A','elbow_extension',['ELBOW_EXTENSION'],['Shoulder','Elbow','Wrist'],'angle(shoulder,elbow,wrist)','degrees','Đo khuỷu trên ảnh; chưa xác nhận đường tạ hoặc tải.',['Quay rõ khuỷu, vai và cổ tay đến cuối pha đẩy.']),
          ('PRESS-02','Độ cao cổ tay so với vai','A','wrist_height',['WRIST_HEIGHT'],['Shoulder','Hip','Wrist'],'(shoulder_y-wrist_y)/projected_torso_length','torso_lengths','Số đo chiều cao 2D không xác nhận độ linh hoạt vai hay an toàn.',['Giữ cổ tay trong khung và quay chính diện để đối chiếu.'])]),
    ]
    for code,name,variant,version,equipment,level,refs,start,phases,criteria in definitions:
        rows=[criterion(identity,title,category,variant,implementation,old,['SIDE'] if implementation!='wrist_height' else ['FRONT'],
                        joints,formula,unit,description,advice,[refs[0]['sourceId']])
              for identity,title,category,implementation,old,joints,formula,unit,description,advice in criteria]
        out.append(standard(code,name,variant,version,equipment,level,refs,start,phases,rows))
    return out


def build():
    index={'schemaVersion':1,'activation':'READ_ONLY_DRAFTS_NO_AUTO_APPROVAL','standards':[]}
    for item in drafts():
        filename=item['standardVersion']+'.json'
        path=ROOT/filename
        if path.exists():
            existing=json.loads(path.read_text(encoding='utf-8'))
            if existing!=item:
                raise RuntimeError('Refusing to overwrite a standard version: '+str(path))
        else:
            path.write_text(json.dumps(item,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        index['standards'].append({'exerciseId':item['exerciseId'],'exerciseVariant':item['exerciseVariant'],
                                   'standardVersion':item['standardVersion'],'path':filename})
    (ROOT/'index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':
    build()
