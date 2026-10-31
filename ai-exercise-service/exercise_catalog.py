"""Exercise-specific technique drafts. No criterion here is Coach approved."""

EXERCISES = {
    'SQUAT': {
        'name': 'Squat', 'phase': 'REPETITIONS',
        'criteria': [
            {'code': 'DEPTH_TARGET', 'title': 'Độ sâu theo mục tiêu', 'description': 'Vị trí hông so với gối ở đáy rep.', 'joints': ['hip', 'knee'], 'views': ['SIDE'], 'source': 'squat', 'goal': 'depthTarget', 'improvement': 'Thử quay ngang và đối chiếu độ sâu với mục tiêu Coach đã chọn.'},
            {'code': 'TORSO_ASCENT_CHANGE', 'title': 'Kiểm soát thân lúc đứng lên', 'description': 'Thay đổi góc thân và nhịp nâng hông–vai đầu pha lên.', 'joints': ['shoulder', 'hip', 'knee', 'ankle'], 'views': ['SIDE'], 'source': 'squat', 'improvement': 'Thử lên chậm và để vai, hông nâng cùng nhịp; nhờ Coach xem lại.'},
            {'code': 'KNEE_INWARD_LEFT', 'title': 'Hướng gối trái', 'description': 'Gối trái dịch vào giữa so với bàn chân trên ảnh.', 'joints': ['leftHip', 'leftKnee', 'leftAnkle', 'leftHeel', 'leftToe', 'rightAnkle'], 'views': ['FRONT'], 'source': 'squat', 'improvement': 'Giữ bàn chân ổn định và nhờ Coach đối chiếu hướng gối với mũi chân.'},
            {'code': 'KNEE_INWARD_RIGHT', 'title': 'Hướng gối phải', 'description': 'Gối phải dịch vào giữa so với bàn chân trên ảnh.', 'joints': ['rightHip', 'rightKnee', 'rightAnkle', 'rightHeel', 'rightToe', 'leftAnkle'], 'views': ['FRONT'], 'source': 'squat', 'improvement': 'Giữ bàn chân ổn định và nhờ Coach đối chiếu hướng gối với mũi chân.'},
            {'code': 'DESCENT_TARGET', 'title': 'Thời gian xuống theo mục tiêu', 'description': 'Thời gian từ đứng đến đáy rep so với mục tiêu đã chọn.', 'joints': ['hip', 'knee', 'ankle'], 'views': ['SIDE', 'FRONT'], 'source': 'squat', 'goal': 'descentTargetSeconds', 'improvement': 'Thử đếm đều theo nhịp đã thống nhất với Coach.'},
        ],
    },
    'PUSH_UP': {
        'name': 'Push-up', 'phase': 'REPETITIONS',
        'criteria': [
            {'code': 'ELBOW_FLEXION', 'title': 'Góc gập khuỷu', 'description': 'Biên độ góc vai–khuỷu–cổ tay.', 'joints': ['Shoulder', 'Elbow', 'Wrist'], 'views': ['SIDE'], 'source': 'angle', 'improvement': 'Quay ngang, thấy rõ vai, khuỷu và cổ tay trong toàn rep.'},
            {'code': 'BODY_ALIGNMENT', 'title': 'Đường vai–hông–cổ chân', 'description': 'Góc thân trên ảnh trong pha chống đẩy.', 'joints': ['Shoulder', 'Hip', 'Ankle'], 'views': ['SIDE'], 'source': 'angle', 'improvement': 'Thử giữ thân ổn định và quay ngang để Coach xem lại.'},
        ],
    },
    'PLANK': {
        'name': 'Plank', 'phase': 'HOLD',
        'criteria': [
            {'code': 'BODY_ALIGNMENT', 'title': 'Đường vai–hông–cổ chân', 'description': 'Góc thân trên ảnh trong khoảng giữ tư thế.', 'joints': ['Shoulder', 'Hip', 'Ankle'], 'views': ['SIDE'], 'source': 'angle', 'improvement': 'Quay ngang, giữ cả vai, hông và cổ chân trong khung.'},
            {'code': 'HIP_HEIGHT', 'title': 'Độ cao hông', 'description': 'Độ lệch hông khỏi đường vai–cổ chân trên ảnh.', 'joints': ['Shoulder', 'Hip', 'Ankle'], 'views': ['SIDE'], 'source': 'hip_line', 'improvement': 'Thử giữ hông ổn định trong khoảng giữ tư thế; nhờ Coach xác nhận.'},
        ],
    },
    'LUNGE': {
        'name': 'Lunge', 'phase': 'REPETITIONS',
        'criteria': [
            {'code': 'KNEE_ANGLE', 'title': 'Góc gối quan sát', 'description': 'Góc hông–gối–cổ chân ở bên thấy rõ hơn; chưa xác định chân trước.', 'joints': ['Hip', 'Knee', 'Ankle'], 'views': ['SIDE'], 'source': 'angle', 'improvement': 'Quay ngang để thấy chân trước và các mốc hông–gối–cổ chân.'},
            {'code': 'TORSO_ANGLE', 'title': 'Góc thân', 'description': 'Góc vai–hông–gối trên ảnh.', 'joints': ['Shoulder', 'Hip', 'Knee'], 'views': ['SIDE'], 'source': 'angle', 'improvement': 'Giữ camera cố định và nhờ Coach đối chiếu thân ở đáy rep.'},
        ],
    },
    'BICEPS_CURL': {
        'name': 'Biceps Curl', 'phase': 'REPETITIONS',
        'criteria': [
            {'code': 'ELBOW_FLEXION', 'title': 'Góc gập khuỷu', 'description': 'Biên độ góc vai–khuỷu–cổ tay.', 'joints': ['Shoulder', 'Elbow', 'Wrist'], 'views': ['SIDE', 'FRONT'], 'source': 'angle', 'improvement': 'Quay rõ cả tay trên và cổ tay trong toàn lần tập.'},
            {'code': 'UPPER_ARM_DRIFT', 'title': 'Dịch chuyển cánh tay trên', 'description': 'Góc cánh tay trên với thân thay đổi theo thời gian.', 'joints': ['Elbow', 'Shoulder', 'Hip'], 'views': ['SIDE'], 'source': 'angle', 'improvement': 'Quay nghiêng để Coach xem vị trí khuỷu so với thân.'},
        ],
    },
    'SHOULDER_PRESS': {
        'name': 'Shoulder Press', 'phase': 'REPETITIONS',
        'criteria': [
            {'code': 'ELBOW_EXTENSION', 'title': 'Góc duỗi khuỷu', 'description': 'Góc vai–khuỷu–cổ tay trong pha đẩy.', 'joints': ['Shoulder', 'Elbow', 'Wrist'], 'views': ['FRONT', 'SIDE'], 'source': 'angle', 'improvement': 'Quay rõ vai, khuỷu và cổ tay từ lúc bắt đầu đến cuối lần đẩy.'},
            {'code': 'WRIST_HEIGHT', 'title': 'Độ cao cổ tay', 'description': 'Độ cao cổ tay so với vai theo chiều dài thân trên ảnh.', 'joints': ['Shoulder', 'Hip', 'Wrist'], 'views': ['FRONT'], 'source': 'wrist_height', 'improvement': 'Quay chính diện và giữ cổ tay trong khung ở cuối pha đẩy.'},
        ],
    },
}


def public_exercises():
    return [{'code': code, 'name': item['name'], 'phase': item['phase'],
             'techniqueStatus': 'NOT_COACH_VALIDATED',
             'measurementStatus': 'SQUAT_REPETITIONS' if code == 'SQUAT' else 'POSE_MEASUREMENTS_ONLY',
             'criteria': [criterion['code'] for criterion in item['criteria']]}
            for code, item in EXERCISES.items()]
