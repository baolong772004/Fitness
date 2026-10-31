export const exerciseCatalog = {
  SQUAT: { name: 'Squat', planName: /squat/i, cameraAngle: 'Quay ngang hoặc chính diện, thấy rõ vai, hông, gối và bàn chân.', measurementStatus: 'SQUAT_REPETITIONS' },
  PUSH_UP: { name: 'Push-up', planName: /push[ -]?up|chống đẩy/i, cameraAngle: 'Quay ngang, thấy vai, khuỷu, cổ tay, hông và chân.', measurementStatus: 'POSE_MEASUREMENTS_ONLY' },
  PLANK: { name: 'Plank', planName: /plank/i, cameraAngle: 'Quay ngang, thấy vai, hông và cổ chân trong suốt thời gian giữ.', measurementStatus: 'POSE_MEASUREMENTS_ONLY' },
  LUNGE: { name: 'Lunge', planName: /lunge|chùng chân/i, cameraAngle: 'Quay ngang, thấy rõ chân trước, hông và vai.', measurementStatus: 'POSE_MEASUREMENTS_ONLY' },
  BICEPS_CURL: { name: 'Biceps Curl', planName: /curl|cuốn tạ/i, cameraAngle: 'Quay ngang hoặc chính diện, thấy vai, khuỷu và cổ tay.', measurementStatus: 'POSE_MEASUREMENTS_ONLY' },
  SHOULDER_PRESS: { name: 'Shoulder Press', planName: /shoulder press|overhead press|đẩy vai/i, cameraAngle: 'Quay chính diện hoặc ngang, thấy vai, khuỷu và cổ tay suốt lần đẩy.', measurementStatus: 'POSE_MEASUREMENTS_ONLY' },
} as const;

export type ExerciseType = keyof typeof exerciseCatalog;
export const exerciseVariants: Record<ExerciseType, string[]> = {
  SQUAT: ['BODYWEIGHT', 'WEIGHTED', 'UNSPECIFIED'], PUSH_UP: ['STANDARD', 'UNSPECIFIED'],
  PLANK: ['FRONT', 'UNSPECIFIED'], LUNGE: ['FORWARD_BODYWEIGHT', 'UNSPECIFIED'],
  BICEPS_CURL: ['DUMBBELL_STANDING', 'UNSPECIFIED'], SHOULDER_PRESS: ['DUMBBELL_SEATED', 'UNSPECIFIED'],
};
export function isExerciseType(value: unknown): value is ExerciseType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(exerciseCatalog, value);
}
export const publicExercises = Object.entries(exerciseCatalog).map(([code, item]) => ({
  code, name: item.name, mediaTypes: ['video'], cameraAngle: item.cameraAngle,
  measurementStatus: item.measurementStatus, techniqueStatus: 'NOT_COACH_VALIDATED',
  supportStatus: 'EXPERIMENTAL', variants: exerciseVariants[code as ExerciseType],
  segmentationStatus: code === 'SQUAT' ? 'EXPERIMENTAL' : 'NOT_IMPLEMENTED',
}));
