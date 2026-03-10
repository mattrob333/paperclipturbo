import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ChevronsUpDown, Plus, Settings } from "lucide-react";
import { Link } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { companiesApi } from "../api/companies";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

function statusDotColor(status?: string): string {
  switch (status) {
    case "active":
      return "bg-green-400";
    case "provisioning":
    case "draft":
      return "bg-blue-400";
    case "paused":
      return "bg-yellow-400";
    case "failed":
      return "bg-red-400";
    case "archived":
      return "bg-neutral-400";
    default:
      return "bg-green-400";
  }
}

export function CompanySwitcher() {
  const { companies, selectedCompany, selectedCompanyId, setSelectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const sidebarCompanies = companies.filter((company) => company.status !== "archived" && company.status !== "draft");

  const archiveMutation = useMutation({
    mutationFn: ({ companyId, nextCompanyId }: { companyId: string; nextCompanyId: string | null }) =>
      companiesApi.archive(companyId).then(() => ({ nextCompanyId })),
    onSuccess: async ({ nextCompanyId }) => {
      setSelectedCompanyId(nextCompanyId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.stats });
    },
  });

  function handleArchiveCurrentCompany() {
    if (!selectedCompany || !selectedCompanyId) return;
    const confirmed = window.confirm(
      `Archive company "${selectedCompany.name}"? It will be hidden from the sidebar.`
    );
    if (!confirmed) return;
    const nextCompanyId =
      sidebarCompanies.find((company) => company.id !== selectedCompanyId)?.id ?? null;
    archiveMutation.mutate({ companyId: selectedCompanyId, nextCompanyId });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-2 py-1.5 h-auto text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            {selectedCompany && (
              <span className={`h-2 w-2 rounded-full shrink-0 ${statusDotColor(selectedCompany.status)}`} />
            )}
            <span className="text-sm font-medium truncate">
              {selectedCompany?.name ?? "Select company"}
            </span>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel>Companies</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sidebarCompanies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => setSelectedCompanyId(company.id)}
            className={company.id === selectedCompany?.id ? "bg-accent" : ""}
          >
            <span className={`h-2 w-2 rounded-full shrink-0 mr-2 ${statusDotColor(company.status)}`} />
            <span className="truncate">{company.name}</span>
            {(company.status === "provisioning" || company.status === "draft" || company.status === "failed") && (
              <span className={cn(
                "ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded",
                company.status === "failed"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              )}>
                {company.status === "failed" ? "Failed" : "Setting up"}
              </span>
            )}
          </DropdownMenuItem>
        ))}
        {sidebarCompanies.length === 0 && (
          <DropdownMenuItem disabled>No companies</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/company/settings" className="no-underline text-inherit">
            <Settings className="h-4 w-4 mr-2" />
            Company Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!selectedCompany || archiveMutation.isPending || selectedCompany.status === "archived"}
          onClick={handleArchiveCurrentCompany}
        >
          <Archive className="h-4 w-4 mr-2" />
          {archiveMutation.isPending ? "Archiving..." : "Archive Current Company"}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/companies" className="no-underline text-inherit">
            <Plus className="h-4 w-4 mr-2" />
            Manage Companies
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
