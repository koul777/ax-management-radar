import { Composition } from 'remotion';
import { AxRadarPromo, TOTAL } from './AxRadarPromo';

export const Root: React.FC = () => {
  return (
    <Composition
      id="AxManagementRadarPromo"
      component={AxRadarPromo}
      durationInFrames={TOTAL}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
