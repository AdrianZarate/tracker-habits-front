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
    onSave={(payload, signal) => updateHabitDefinition(habit.habitId, payload, signal)}
    onSaved={onUpdated} onClose={onClose}
  />;
}
