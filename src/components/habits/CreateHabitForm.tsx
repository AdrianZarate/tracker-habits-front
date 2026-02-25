import { useState } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { createHabit } from '../../api/habits.api';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface CreateHabitFormProps {
  onCreated: () => void;
  onClose: () => void;
}

export default function CreateHabitForm({
  onCreated,
  onClose,
}: CreateHabitFormProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await createHabit({ title });
      onCreated();
      onClose();
    } catch {
      setError('No se pudo crear el hábito. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4'>
      <div className='w-full max-w-md rounded-2xl bg-dark-card p-6 shadow-xl'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-lg font-bold text-dark-text'>Nuevo hábito</h2>
          <button
            onClick={onClose}
            className='text-dark-muted transition hover:text-dark-text'
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <Input
            label='Título'
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Ej. Meditar 10 minutos'
            autoFocus
          />

          {error && <p className='text-sm text-red-400'>{error}</p>}

          <div className='flex justify-end gap-3 pt-2'>
            <Button variant='ghost' type='button' onClick={onClose}>
              Cancelar
            </Button>
            <Button type='submit' isLoading={isLoading}>
              Crear hábito
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
