import Skeleton from "./Skeleton";
import Card from "./Card";

export default function SkeletonLoanCard() {
  return (
    <Card aria-busy="true" aria-label="Loading loan">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="text-right space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </Card>
  );
}
