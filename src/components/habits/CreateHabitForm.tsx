import { createHabit } from '../../api/habits.api';
import HabitDefinitionForm from './HabitDefinitionForm';

interface CreateHabitFormProps {
  onCreated: () => void;
  onClose: () => void;
}

export default function CreateHabitForm({ onCreated, onClose }: CreateHabitFormProps) {
  return <HabitDefinitionForm
    onSave={({ title }, signal) => createHabit({ title }, signal)}
    onSaved={() => { onCreated(); onClose(); }}
    onClose={onClose}
  />;
}
