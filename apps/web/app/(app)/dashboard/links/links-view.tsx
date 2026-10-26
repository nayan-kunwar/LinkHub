"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BarChart3,
  GripVertical,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Category, Link as LinkRecord, LinkFormValues } from "@linkhub/shared";
import { LIMITS } from "@linkhub/shared";
import { CategoryPill } from "@/components/category-pill";
import { DashboardFrame } from "@/components/dashboard-frame";
import { DashboardPreview } from "@/components/dashboard-preview";
import { LinkIcon } from "@/components/link-icon";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { sumSeries, useLinkSeries, type RangeDays } from "@/lib/analytics";
import { useAppData } from "@/lib/store";
import { useRange } from "@/lib/use-range";
import { cn, formatNumber } from "@/lib/utils";
import { LinkDialog } from "./link-dialog";

type CategoryFilter = "all" | "none" | string;
type StatusFilter = "all" | "active" | "inactive" | "hidden";
type SortOrder = "position" | "clicks" | "title" | "newest";

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "hidden", label: "Hidden via category" },
];

const SORT_OPTIONS: Array<{ value: SortOrder; label: string }> = [
  { value: "position", label: "Sort by position" },
  { value: "clicks", label: "Most clicks" },
  { value: "title", label: "Title A–Z" },
  { value: "newest", label: "Newest" },
];

export function LinksFallback() {
  return (
    <DashboardFrame preview={<DashboardPreview tips />}>
      <PageHeader
        title="Links"
        description="Manage your links, organize them with categories and reorder them by dragging."
      />
      <Card className="mb-4 h-[4.25rem] animate-pulse bg-violet-50/40" />
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-[4.5rem] animate-pulse rounded-2xl border border-line bg-white" />
        ))}
      </div>
      <p className="sr-only" role="status">
        Loading links
      </p>
    </DashboardFrame>
  );
}

function SortableLinkRow({
  link,
  category,
  count,
  range,
  canDrag,
  onToggle,
  onEdit,
  onDelete,
  onKeyboardMove,
}: {
  link: LinkRecord;
  category: Category | null;
  count: number;
  range: RangeDays;
  canDrag: boolean;
  onToggle: (link: LinkRecord) => void;
  onEdit: (link: LinkRecord) => void;
  onDelete: (link: LinkRecord) => void;
  onKeyboardMove: (link: LinkRecord, direction: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
    disabled: !canDrag,
  });
  const hiddenByCategory = category ? !category.isVisible : false;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-3 py-3 shadow-card sm:flex-nowrap sm:gap-4 sm:px-4",
        isDragging && "relative z-10 opacity-60 shadow-float",
      )}
    >
      <button
        type="button"
        data-handle-id={link.id}
        disabled={!canDrag}
        aria-label={
          canDrag
            ? `Reorder ${link.title}. Press the up or down arrow key to move it.`
            : `Reordering ${link.title} is unavailable while filters or a different sort are applied.`
        }
        className={cn(
          "-ml-1 inline-flex size-7 shrink-0 touch-none items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200",
          canDrag
            ? "cursor-grab text-zinc-500 hover:bg-violet-50 hover:text-violet-900 active:cursor-grabbing"
            : "cursor-not-allowed text-zinc-300",
        )}
        onKeyDown={(event) => {
          if (!canDrag) return;
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onKeyboardMove(link, -1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            onKeyboardMove(link, 1);
          }
        }}
        {...(canDrag ? attributes : {})}
        {...(canDrag ? listeners : {})}
      >
        <GripVertical aria-hidden="true" className="size-5" />
      </button>

      <Switch
        checked={link.isActive}
        onCheckedChange={() => onToggle(link)}
        aria-label={`${link.title} active`}
      />

      <LinkIcon icon={link.icon} url={link.url} className="size-7 shrink-0 text-violet-700" />

      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate font-semibold text-zinc-900">{link.title}</p>
        <p className="truncate text-xs text-zinc-600">{link.url}</p>
      </div>

      <div className="order-last flex w-full flex-wrap gap-1 sm:order-none sm:w-44">
        <CategoryPill category={category} />
        {hiddenByCategory ? (
          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
            Hidden via category
          </span>
        ) : null}
        {!link.isActive ? (
          <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">
            Inactive
          </span>
        ) : null}
      </div>

      <div
        className="w-14 shrink-0 text-right sm:w-20"
        title={`Recorded clicks in the last ${range} days`}
      >
        <p className="text-sm font-bold text-zinc-900">{formatNumber(count)}</p>
        <p className="text-[11px] text-zinc-600">clicks</p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onEdit(link)}
          aria-label={`Edit ${link.title}`}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button asChild variant="outline" size="icon-sm" aria-label={`Analytics for ${link.title}`}>
          <Link href={`/dashboard/analytics?linkId=${link.id}`}>
            <BarChart3 className="size-3.5" />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onDelete(link)}
          aria-label={`Delete ${link.title}`}
          className="hover:border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}

export function LinksView() {
  const { state, hydrated, addLink, updateLink, deleteLink, toggleLink, reorderLinks } =
    useAppData();
  const searchParams = useSearchParams();
  const [range] = useRange(30);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOrder>("position");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LinkRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LinkRecord | null>(null);
  const [dragMessage, setDragMessage] = useState("");
  const [focusHandleId, setFocusHandleId] = useState<string | null>(null);
  const handledParamRef = useRef("");

  const queryParam = searchParams.get("q") ?? "";
  const addParam = searchParams.get("add");
  const editParam = searchParams.get("edit");

  useEffect(() => {
    setQuery(queryParam);
  }, [queryParam]);

  useEffect(() => {
    if (!addParam && !editParam) {
      handledParamRef.current = "";
      return;
    }
    if (!hydrated) return;
    const key = `${addParam ?? ""}:${editParam ?? ""}`;
    if (handledParamRef.current === key) return;

    if (addParam === "1") {
      setEditing(null);
      setDialogOpen(true);
      handledParamRef.current = key;
      return;
    }

    if (editParam) {
      const link = state.links.find((item) => item.id === editParam);
      if (!link) return;
      setEditing(link);
      setDialogOpen(true);
      handledParamRef.current = key;
    }
  }, [addParam, editParam, hydrated, state.links]);

  useEffect(() => {
    setDragMessage("");
  }, [query, categoryFilter, statusFilter, sort]);

  useEffect(() => {
    if (!focusHandleId) return;
    const handle = document.querySelector<HTMLButtonElement>(`[data-handle-id="${focusHandleId}"]`);
    handle?.focus();
    setFocusHandleId(null);
  }, [focusHandleId, state.links]);

  const categoriesById = useMemo(
    () => new Map(state.categories.map((category) => [category.id, category])),
    [state.categories],
  );

  const { seriesById } = useLinkSeries(state.links, range);
  const counts = useMemo(
    () =>
      new Map(
        state.links.map((link) => [link.id, sumSeries(seriesById.get(link.id))]),
      ),
    [state.links, seriesById],
  );

  const visibleLinks = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = state.links.filter((link) => {
      const category = link.categoryId ? categoriesById.get(link.categoryId) ?? null : null;
      if (term) {
        const haystack = `${link.title} ${link.url} ${category?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (categoryFilter === "none") {
        if (link.categoryId) return false;
      } else if (categoryFilter !== "all" && link.categoryId !== categoryFilter) {
        return false;
      }
      if (statusFilter === "active" && !link.isActive) return false;
      if (statusFilter === "inactive" && link.isActive) return false;
      if (statusFilter === "hidden" && !(category && !category.isVisible)) return false;
      return true;
    });

    list = [...list];
    if (sort === "clicks") {
      list.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
    } else if (sort === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "newest") {
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return list;
  }, [state.links, categoriesById, query, categoryFilter, statusFilter, sort, counts]);

  const canDrag =
    sort === "position" &&
    !query.trim() &&
    categoryFilter === "all" &&
    statusFilter === "all" &&
    visibleLinks.length > 1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (link: LinkRecord) => {
    setEditing(link);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditing(null);
  };

  const handleLinkSubmit = async (values: LinkFormValues) => {
    const ok = editing
      ? await updateLink(editing.id, values)
      : await addLink(values);
    if (!ok) return;
    toast.success(`${values.title} ${editing ? "updated" : "added"}`);
    setDialogOpen(false);
    setEditing(null);
  };

  const handleToggle = async (link: LinkRecord) => {
    const ok = await toggleLink(link.id);
    if (ok) {
      toast.success(`${link.title} ${link.isActive ? "deactivated" : "activated"}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const ok = await deleteLink(deleteTarget.id);
    if (ok) {
      toast.success(`${deleteTarget.title} deleted`);
      setDeleteTarget(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeLink = state.links.find((link) => link.id === active.id);
    if (!activeLink) return;
    const ok = await reorderLinks(String(active.id), String(over.id));
    if (!ok) return;
    setDragMessage(`${activeLink.title} moved. Order saved.`);
    toast.success("Order saved");
  };

  const handleKeyboardMove = async (link: LinkRecord, direction: -1 | 1) => {
    const index = state.links.findIndex((item) => item.id === link.id);
    if (index === -1) return;
    const target = state.links[index + direction];
    if (!target) return;
    const ok = await reorderLinks(link.id, target.id);
    if (!ok) return;
    setDragMessage(`${link.title} moved to position ${index + direction + 1}. Order saved.`);
    setFocusHandleId(link.id);
  };

  const clearFilters = () => {
    setQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setSort("position");
  };

  const hasFilters =
    query.trim() !== "" || categoryFilter !== "all" || statusFilter !== "all" || sort !== "position";
  const atLimit = state.links.length >= LIMITS.maxLinks;

  return (
    <DashboardFrame preview={<DashboardPreview tips />}>
      <PageHeader
        title="Links"
        description="Manage your links, organize them with categories and reorder them by dragging."
        actions={
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Add link
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[12rem] flex-1">
          <label htmlFor="links-search" className="sr-only">
            Search links
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
          />
          <Input
            id="links-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search links…"
            className="pl-9"
          />
        </div>

        <label htmlFor="links-category" className="sr-only">
          Filter by category
        </label>
        <Select
          id="links-category"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="w-auto min-w-40"
        >
          <option value="all">All categories</option>
          {state.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.isVisible ? "" : " (hidden)"}
            </option>
          ))}
          <option value="none">Uncategorized</option>
        </Select>

        <label htmlFor="links-status" className="sr-only">
          Filter by status
        </label>
        <Select
          id="links-status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="w-auto min-w-36"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <label htmlFor="links-sort" className="sr-only">
          Sort links
        </label>
        <Select
          id="links-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOrder)}
          className="w-auto min-w-44"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Card>

      <p className="mb-2 text-xs text-zinc-600" aria-live="polite">
        {dragMessage ||
          (canDrag
            ? "Drag the handle to reorder. Keyboard: focus a handle and press ↑ / ↓."
            : "Reordering is available when sorted by position with no filters.")}
      </p>

      {state.links.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Link2 aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-zinc-900">No links yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-600">
            Add your first link to start building your public page.
          </p>
          <Button onClick={openAdd} className="mt-5">
            <Plus className="size-4" /> Add your first link
          </Button>
        </Card>
      ) : visibleLinks.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-semibold text-zinc-800">No links match these filters.</p>
          <p className="mt-1 text-sm text-zinc-600">Try a different search or clear the filters.</p>
          {hasFilters ? (
            <Button variant="secondary" onClick={clearFilters} className="mt-4">
              Clear filters
            </Button>
          ) : null}
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => {
            void handleDragEnd(event);
          }}
        >
          <SortableContext
            items={visibleLinks.map((link) => link.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2" aria-label="Links">
              {visibleLinks.map((link) => (
                <SortableLinkRow
                  key={link.id}
                  link={link}
                  category={link.categoryId ? categoriesById.get(link.categoryId) ?? null : null}
                  count={counts.get(link.id) ?? 0}
                  range={range}
                  canDrag={canDrag}
                  onToggle={(link) => {
                    void handleToggle(link);
                  }}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                  onKeyboardMove={(link, direction) => {
                    void handleKeyboardMove(link, direction);
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {state.links.length > 0 ? (
        atLimit ? (
          <p className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-600">
            You&apos;ve reached the {LIMITS.maxLinks}-link limit on the free plan.
          </p>
        ) : (
          <button
            type="button"
            onClick={openAdd}
            className="mt-4 w-full rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/50 py-6 text-center transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
          >
            <span className="text-sm font-semibold text-violet-800">+ Add a new link</span>
            <span className="mt-1 block text-xs text-zinc-600">
              Your profile, a project, an article, or anything you want to share.
            </span>
          </button>
        )
      ) : null}

      <p className="mt-4 text-xs text-zinc-500">
        Click counts cover the last {range} days and are recorded in UTC.
      </p>

      <LinkDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        link={editing}
        categories={state.categories}
        linkCount={state.links.length}
        onSubmit={(values) => {
          void handleLinkSubmit(values);
        }}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete link?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  &ldquo;{deleteTarget.title}&rdquo; and its click history will be removed. This
                  can&apos;t be undone.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void confirmDelete();
              }}
            >
              Delete link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardFrame>
  );
}
