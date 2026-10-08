import { updateHabitDefinition } from '../../api/habits.api';
import type { HabitDetail } from '../../api/habits.api';
import HabitDefinitionForm from './HabitDefinitionForm';

interface EditHabitFormProps {
  habit: HabitDetail;
  onUpdated: () => void;
  onClose: () => void;
}

export default function EditHabitForm({ habit, onUpdated, onClose }: EditHabitFormProps) {
  return <HabitDefinitionForm habit={habit}
    onSave={({ title }, signal) => updateHabitDefinition(habit.habitId, { title }, signal)}
    onSaved={onUpdated} onClose={onClose}
  />;
}
