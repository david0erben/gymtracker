import { useActivePlan, useStore } from '../../state/store';
import { CardioDay } from './CardioDay';
import { RestDay } from './RestDay';
import { StrengthDay } from './StrengthDay';

export function TrainingScreen() {
  const day = useStore((state) => state.selectedDay);
  const plan = useActivePlan();
  const kind = plan.days[day].kind;
  if (kind === 'cardio') return <CardioDay key={day} day={day} />;
  if (kind === 'rest') return <RestDay key={day} />;
  return <StrengthDay key={`${plan.id}:${day}`} plan={plan} day={day} />;
}
