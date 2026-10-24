import { isCardioDay } from '../../domain/cardio';
import { useStore } from '../../state/store';
import { CardioDay } from './CardioDay';
import { StrengthDay } from './StrengthDay';

export function TrainingScreen() {
  const day = useStore((state) => state.selectedDay);
  return isCardioDay(day) ? <CardioDay key={day} day={day} /> : <StrengthDay key={day} day={day} />;
}
