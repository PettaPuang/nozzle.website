import { PERTAMINA_COLORS } from "@/lib/utils/product-colors";

type PertaminaStripesProps = {
  height?: string;
  skew?: boolean;
  skewDegree?: number;
  gap?: string;
};

export function PertaminaStripes({
  height = "h-1",
  skew = true,
  skewDegree = 25,
  gap = "gap-1",
}: PertaminaStripesProps) {
  return (
    <div
      className={`flex ${gap} ${height} origin-bottom-left`}
      style={skew ? { transform: `skewX(-${skewDegree}deg)` } : undefined}
    >
      <div
        className="flex-[2]"
        style={{ backgroundColor: PERTAMINA_COLORS.blue }}
      />
      <div
        className="flex-1"
        style={{ backgroundColor: PERTAMINA_COLORS.red }}
      />
      <div
        className="flex-1"
        style={{ backgroundColor: PERTAMINA_COLORS.green }}
      />
    </div>
  );
}
