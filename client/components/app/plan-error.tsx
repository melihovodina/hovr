import Link from "next/link";
import { Notice } from "@/components/auth/fields";
import { ApiError, errorMessage } from "@/lib/api";

// An error as a notice; a plan limit adds a link to the plans. A string is shown as it is.
export function PlanError({ error, billingHref }: { error: unknown; billingHref: string }) {
  return (
    <Notice tone="bad">
      {typeof error === "string" ? error : errorMessage(error)}
      {error instanceof ApiError && error.upgradeRequired && (
        <>
          {" "}
          <Link href={billingHref} className="underline">
            See plans
          </Link>
        </>
      )}
    </Notice>
  );
}
