import { useMutation } from "@tanstack/react-query";
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import type { ConnectionValidation } from "@paperclipai/shared";
import { instancesApi } from "../../api/instances";
import { Button } from "@/components/ui/button";

interface WizardStepValidateProps {
  companySlug: string;
  validation: ConnectionValidation | null;
  onValidationResult: (result: ConnectionValidation) => void;
}

const statusConfig = {
  pass: {
    icon: CheckCircle2,
    className: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30",
  },
  fail: {
    icon: XCircle,
    className: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30",
  },
  warn: {
    icon: AlertTriangle,
    className: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30",
  },
};

export function WizardStepValidate({
  companySlug,
  validation,
  onValidationResult,
}: WizardStepValidateProps) {
  const validateMutation = useMutation({
    mutationFn: () => instancesApi.validate(companySlug),
    onSuccess: onValidationResult,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-muted/50 p-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium">Validate instance</h3>
          <p className="text-xs text-muted-foreground">
            Run validation checks on the instance configuration.
          </p>
        </div>
      </div>

      {!validation && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Button
            size="sm"
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending}
          >
            {validateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
            )}
            {validateMutation.isPending ? "Validating..." : "Run Validation"}
          </Button>
          {validateMutation.isError && (
            <p className="text-xs text-destructive">
              {validateMutation.error instanceof Error
                ? validateMutation.error.message
                : "Validation failed"}
            </p>
          )}
        </div>
      )}

      {validation && (
        <div className="space-y-3">
          {/* Overall status */}
          <div
            className={`rounded-md border px-3 py-2.5 flex items-center gap-2 ${
              statusConfig[validation.overallStatus].bg
            }`}
          >
            {(() => {
              const Icon = statusConfig[validation.overallStatus].icon;
              return (
                <Icon
                  className={`h-4 w-4 ${
                    statusConfig[validation.overallStatus].className
                  }`}
                />
              );
            })()}
            <span className="text-sm font-medium capitalize">
              Overall: {validation.overallStatus}
            </span>
          </div>

          {/* Individual checks */}
          <div className="space-y-1.5">
            {validation.checks.map((check, idx) => {
              const config = statusConfig[check.status];
              const Icon = config.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-md border border-border px-3 py-2"
                >
                  <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${config.className}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{check.name}</p>
                    <p className="text-xs text-muted-foreground">{check.message}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Re-run button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending}
          >
            {validateMutation.isPending ? "Re-validating..." : "Re-run Validation"}
          </Button>
        </div>
      )}
    </div>
  );
}
