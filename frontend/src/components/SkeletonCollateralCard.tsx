import Skeleton from "./Skeleton";
import Card from "./Card";

export default function SkeletonCollateralCard() {
  return (
    <Card
      aria-busy="true"
      aria-label="Loading collateral"
      header={
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      }
      footer={<Skeleton className="h-3 w-24" />}
    >
      <Skeleton className="h-5 w-28 mb-3" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </Card>
  );
}
