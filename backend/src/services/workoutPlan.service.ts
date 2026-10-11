export type PlanExercise = {
  exerciseName: string;
  sets: number;
  reps: number;
  weightKg: number | null;
  notes: string;
};

export type PlanSession = {
  dayOfWeek: number;
  title: string;
  notes: string;
  exercises: PlanExercise[];
};

export type PlanMeal = {
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  time: string;
  food: string;
  portion: string;
  calories: number | null;
  notes: string;
};

export type PlanMealDay = {
  dayOfWeek: number;
  notes: string;
  meals: PlanMeal[];
};

const requiredText = (value: unknown, maxLength: number, field: string) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`${field} phải có từ 1 đến ${maxLength} ký tự`);
  }
  return value.trim();
};

const optionalText = (value: unknown, maxLength: number, field: string) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new Error(`${field} tối đa ${maxLength} ký tự`);
  }
  return value.trim();
};

const positiveInteger = (value: unknown, max: number, field: string) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new Error(`${field} phải là số nguyên từ 1 đến ${max}`);
  }
  return number;
};

const dayOfWeek = (value: unknown) => positiveInteger(value, 7, 'Ngày trong tuần');

export function normalizeWorkoutPlanContent(body: any) {
  if (body.sessions !== undefined && !Array.isArray(body.sessions)) {
    throw new Error('Danh sách buổi tập không hợp lệ');
  }
  if (body.mealDays !== undefined && !Array.isArray(body.mealDays)) {
    throw new Error('Thực đơn theo ngày không hợp lệ');
  }
  const rawSessions: any[] = body.sessions ?? [];
  const rawMealDays: any[] = body.mealDays ?? [];
  if (rawSessions.length > 21 || rawMealDays.length > 7) {
    throw new Error('Giáo án tối đa 21 buổi tập và thực đơn tối đa 7 ngày');
  }

  const sessions: PlanSession[] = rawSessions.map((session) => {
    if (!session || !Array.isArray(session.exercises) || session.exercises.length < 1 || session.exercises.length > 20) {
      throw new Error('Mỗi buổi cần từ 1 đến 20 bài tập');
    }
    return {
      dayOfWeek: dayOfWeek(session.dayOfWeek),
      title: requiredText(session.title, 120, 'Tên buổi tập'),
      notes: optionalText(session.notes, 1000, 'Ghi chú buổi tập'),
      exercises: session.exercises.map((exercise: any) => {
        const weightKg = exercise?.weightKg === undefined || exercise?.weightKg === null || exercise?.weightKg === ''
          ? null : Number(exercise.weightKg);
        if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 500)) {
          throw new Error('Mức tạ phải từ 0 đến 500 kg');
        }
        return {
          exerciseName: requiredText(exercise?.exerciseName, 120, 'Tên bài tập'),
          sets: positiveInteger(exercise?.sets, 100, 'Số hiệp'),
          reps: positiveInteger(exercise?.reps, 1000, 'Số lần'),
          weightKg,
          notes: optionalText(exercise?.notes, 500, 'Ghi chú bài tập'),
        };
      }),
    };
  });

  const mealDays: PlanMealDay[] = rawMealDays.map((day) => {
    if (!day || !Array.isArray(day.meals) || day.meals.length < 1 || day.meals.length > 8) {
      throw new Error('Mỗi ngày cần từ 1 đến 8 bữa ăn');
    }
    return {
      dayOfWeek: dayOfWeek(day.dayOfWeek),
      notes: optionalText(day.notes, 1000, 'Ghi chú dinh dưỡng'),
      meals: day.meals.map((meal: any) => {
        if (!['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'].includes(meal?.mealType)) {
          throw new Error('Loại bữa ăn không hợp lệ');
        }
        const calories = meal.calories === undefined || meal.calories === null || meal.calories === ''
          ? null : Number(meal.calories);
        if (calories !== null && (!Number.isInteger(calories) || calories < 0 || calories > 10000)) {
          throw new Error('Năng lượng bữa ăn phải từ 0 đến 10000 kcal');
        }
        const time = optionalText(meal.time, 5, 'Giờ ăn');
        if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
          throw new Error('Giờ ăn phải có dạng HH:mm');
        }
        return {
          mealType: meal.mealType as PlanMeal['mealType'],
          time,
          food: requiredText(meal.food, 300, 'Tên món ăn'),
          portion: requiredText(meal.portion, 120, 'Khẩu phần'),
          calories,
          notes: optionalText(meal.notes, 500, 'Ghi chú bữa ăn'),
        };
      }),
    };
  });
  if (new Set(mealDays.map(day => day.dayOfWeek)).size !== mealDays.length) {
    throw new Error('Mỗi ngày chỉ có một thực đơn; hãy thêm các bữa vào cùng ngày');
  }
  return { sessionsJson: JSON.stringify(sessions), mealsJson: JSON.stringify(mealDays) };
}

const readArray = <T>(value: string | null): T[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

export function presentWorkoutPlan<T extends { sessionsJson: string | null; mealsJson: string | null }>(plan: T) {
  const { sessionsJson, mealsJson, ...rest } = plan;
  return {
    ...rest,
    sessions: readArray<PlanSession>(sessionsJson),
    mealDays: readArray<PlanMealDay>(mealsJson),
  };
}
