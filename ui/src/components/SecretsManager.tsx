import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CompanySecret } from "@paperclipai/shared";
import { secretsApi } from "../api/secrets";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Key, Plus, RotateCw, Trash2, Loader2, Eye } from "lucide-react";

const COMMON_SECRET_NAMES = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "GOOGLE_API_KEY",
] as const;

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function SecretsManager({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [rotateSecret, setRotateSecret] = useState<CompanySecret | null>(null);
  const [deleteSecret, setDeleteSecret] = useState<CompanySecret | null>(null);
  const [usageSecret, setUsageSecret] = useState<CompanySecret | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [customName, setCustomName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Rotate form state
  const [rotateValue, setRotateValue] = useState("");

  const { data: secrets = [], isLoading } = useQuery({
    queryKey: queryKeys.secrets.list(companyId),
    queryFn: () => secretsApi.list(companyId),
  });

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ["secrets", "usage", usageSecret?.id],
    queryFn: () => secretsApi.usage(usageSecret!.id),
    enabled: !!usageSecret,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; value: string; description?: string }) =>
      secretsApi.create(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.secrets.list(companyId) });
      resetAddForm();
    },
  });

  const rotateMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      secretsApi.rotate(id, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.secrets.list(companyId) });
      setRotateSecret(null);
      setRotateValue("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => secretsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.secrets.list(companyId) });
      setDeleteSecret(null);
    },
  });

  function resetAddForm() {
    setAddOpen(false);
    setNewName("");
    setCustomName("");
    setNewValue("");
    setNewDescription("");
  }

  const effectiveName = newName === "__custom__" ? customName.trim() : newName;
  const existingNames = new Set(secrets.map((s) => s.name));

  return (
    <div className="space-y-4">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        API Keys &amp; Secrets
      </div>
      <div className="space-y-3 rounded-md border border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Credentials</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Secret
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading secrets...</span>
          </div>
        ) : secrets.length === 0 ? (
          <div className="text-center py-6">
            <Key className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No secrets yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Add API keys to securely reference them in agent configurations.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {secrets.map((secret) => (
              <SecretRow
                key={secret.id}
                secret={secret}
                onRotate={() => setRotateSecret(secret)}
                onDelete={() => setDeleteSecret(secret)}
                onViewUsage={() => setUsageSecret(secret)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Secret Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) resetAddForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Secret</DialogTitle>
            <DialogDescription>
              Store an API key or credential securely. Values are encrypted and never shown again after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <select
                className={`${inputClass} bg-background`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              >
                <option value="">Select a secret name...</option>
                {COMMON_SECRET_NAMES.map((name) => (
                  <option key={name} value={name} disabled={existingNames.has(name)}>
                    {name}{existingNames.has(name) ? " (exists)" : ""}
                  </option>
                ))}
                <option value="__custom__">Custom name...</option>
              </select>
              {newName === "__custom__" && (
                <input
                  className={`${inputClass} mt-2`}
                  placeholder="MY_CUSTOM_KEY"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                  autoFocus
                />
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Value</label>
              <input
                type="password"
                className={inputClass}
                placeholder="sk-..."
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
              <input
                className={inputClass}
                placeholder="e.g. Production API key for Claude"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            {createMutation.isError && (
              <p className="text-xs text-destructive">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : "Failed to create secret"}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={resetAddForm}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!effectiveName || !newValue.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  name: effectiveName,
                  value: newValue,
                  ...(newDescription.trim() ? { description: newDescription.trim() } : {}),
                })
              }
            >
              {createMutation.isPending ? "Creating..." : "Create Secret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate Secret Dialog */}
      <Dialog
        open={!!rotateSecret}
        onOpenChange={(open) => { if (!open) { setRotateSecret(null); setRotateValue(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate Secret</DialogTitle>
            <DialogDescription>
              Replace the value of <span className="font-mono font-medium">{rotateSecret?.name}</span> with a new one.
              Currently on version {rotateSecret?.latestVersion}. All agents referencing this secret will use the new value.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">New value</label>
              <input
                type="password"
                className={inputClass}
                placeholder="sk-..."
                value={rotateValue}
                onChange={(e) => setRotateValue(e.target.value)}
                autoFocus
              />
            </div>
            {rotateMutation.isError && (
              <p className="text-xs text-destructive">
                {rotateMutation.error instanceof Error
                  ? rotateMutation.error.message
                  : "Failed to rotate secret"}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setRotateSecret(null); setRotateValue(""); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!rotateValue.trim() || rotateMutation.isPending}
              onClick={() => {
                if (!rotateSecret) return;
                rotateMutation.mutate({ id: rotateSecret.id, value: rotateValue });
              }}
            >
              {rotateMutation.isPending ? "Rotating..." : "Rotate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Secret Dialog */}
      <Dialog
        open={!!deleteSecret}
        onOpenChange={(open) => { if (!open) setDeleteSecret(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Secret</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-mono font-medium">{deleteSecret?.name}</span>?
              Any agents referencing this secret will fail to resolve it.
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.isError && (
            <p className="text-xs text-destructive">
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : "Failed to delete secret"}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteSecret(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!deleteSecret) return;
                deleteMutation.mutate(deleteSecret.id);
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usage Dialog */}
      <Dialog
        open={!!usageSecret}
        onOpenChange={(open) => { if (!open) setUsageSecret(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Secret Usage</DialogTitle>
            <DialogDescription>
              Agents referencing <span className="font-mono font-medium">{usageSecret?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {usageLoading ? (
              <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : (usageData?.usedBy?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No agents are currently referencing this secret.
              </p>
            ) : (
              <div className="space-y-2">
                {usageData?.usedBy.map((agent) => (
                  <div key={agent.agentId} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm font-medium">{agent.agentName}</span>
                    <Badge variant="outline" className="text-[10px]">{agent.agentStatus}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SecretRow({
  secret,
  onRotate,
  onDelete,
  onViewUsage,
}: {
  secret: CompanySecret;
  onRotate: () => void;
  onDelete: () => void;
  onViewUsage: () => void;
}) {
  const createdAt = new Date(secret.createdAt).toLocaleDateString();

  return (
    <div className="flex items-center justify-between py-2.5 gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-medium truncate">{secret.name}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">
            v{secret.latestVersion}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            Created {createdAt}
          </span>
          {secret.description && (
            <>
              <span className="text-[11px] text-muted-foreground/40">|</span>
              <span className="text-[11px] text-muted-foreground truncate">
                {secret.description}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          className="p-1.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
          title="View usage"
          onClick={onViewUsage}
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="p-1.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
          title="Rotate"
          onClick={onRotate}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Delete"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
