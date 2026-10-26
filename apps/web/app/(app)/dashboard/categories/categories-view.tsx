"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Eye, EyeOff, Folder, GripVertical, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Category, CategoryFormValues } from "@linkhub/shared";
import { LIMITS } from "@linkhub/shared";
import { CategoryIcon } from "@/components/category-icon";
import { DashboardFrame } from "@/components/dashboard-frame";
import { DashboardPreview } from "@/components/dashboard-preview";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { useAppData } from "@/lib/store";
import { cn, hexToRgba, shadeHex } from "@/lib/utils";
import { CategoryDialog } from "./category-dialog";

function SortableCategoryRow({
  category,
  linkCount,
  canDrag,
  onToggle,
  onEdit,
  onDelete,
  onKeyboardMove,
}: {
  category: Category;
  linkCount: number;
  canDrag: boolean;
  onToggle: (category: Category) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onKeyboardMove: (category: Category, direction: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: !canDrag,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-3 py-3.5 shadow-card sm:flex-nowrap sm:gap-4 sm:px-4",
        !category.isVisible && "bg-zinc-50",
        isDragging && "relative z-10 opacity-60 shadow-float",
      )}
    >
      <button
        type="button"
        data-handle-id={category.id}
        disabled={!canDrag}
        aria-label={
          canDrag
            ? `Reorder ${category.name}. Press the up or down arrow key to move it.`
            : `Reordering ${category.name} needs at least two categories.`
        }
        className={cn(
          "-ml-1 inline-flex size-7 shrink-0 touch-none items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200",
          canDrag
            ? "cursor-grab text-zinc-400 hover:bg-violet-50 hover:text-violet-900 active:cursor-grabbing"
            : "cursor-not-allowed text-zinc-300",
        )}
        onKeyDown={(event) => {
          if (!canDrag) return;
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onKeyboardMove(category, -1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            onKeyboardMove(category, 1);
          }
        }}
        {...(canDrag ? attributes : {})}
        {...(canDrag ? listeners : {})}
      >
        <GripVertical aria-hidden="true" className="size-5" />
      </button>

      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: hexToRgba(category.color, 0.12),
          color: shadeHex(category.color, 0.6),
        }}
      >
        <CategoryIcon icon={category.icon} className="size-5" />
      </span>

      <div className="min-w-0 flex-1 basis-40">
        <p className="font-bold text-zinc-900">{category.name}</p>
        <p className="truncate text-xs text-zinc-600">
          {category.description || "No description"}
        </p>
      </div>

      <span className="w-16 shrink-0 text-sm text-zinc-700">
        {linkCount} link{linkCount === 1 ? "" : "s"}
      </span>

      <Badge
        variant={category.isVisible ? "green" : "zinc"}
        className="w-20 shrink-0 justify-center"
      >
        {category.isVisible ? "Visible" : "Hidden"}
      </Badge>

      <Switch
        checked={category.isVisible}
        onCheckedChange={() => onToggle(category)}
        aria-label={`Show ${category.name} on profile`}
      />

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onEdit(category)}
          aria-label={`Edit ${category.name}`}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onDelete(category)}
          aria-label={`Delete ${category.name}`}
          className="hover:border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}

export function CategoriesView() {
  const {
    state,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleCategory,
    reorderCategories,
  } = useAppData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [dragMessage, setDragMessage] = useState("");
  const [focusHandleId, setFocusHandleId] = useState<string | null>(null);

  const linkCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of state.links) {
      if (!link.categoryId) continue;
      counts.set(link.categoryId, (counts.get(link.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [state.links]);

  const categorizedLinks = useMemo(() => {
    const categoryIds = new Set(state.categories.map((category) => category.id));
    return state.links.filter((link) => link.categoryId && categoryIds.has(link.categoryId)).length;
  }, [state.links, state.categories]);

  const visibleCount = state.categories.filter((category) => category.isVisible).length;
  const hiddenCount = state.categories.length - visibleCount;
  const uncategorizedCount = state.links.length - categorizedLinks;
  const canDrag = state.categories.length > 1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    if (!focusHandleId) return;
    const handle = document.querySelector<HTMLButtonElement>(`[data-handle-id="${focusHandleId}"]`);
    handle?.focus();
    setFocusHandleId(null);
  }, [focusHandleId, state.categories]);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditing(null);
  };

  const handleSubmit = async (values: CategoryFormValues) => {
    const ok = editing
      ? await updateCategory(editing.id, values)
      : await addCategory(values);
    if (!ok) return;
    toast.success(`${values.name} ${editing ? "updated" : "added"}`);
    setDialogOpen(false);
    setEditing(null);
  };

  const handleToggle = async (category: Category) => {
    const ok = await toggleCategory(category.id);
    if (ok) {
      toast.success(`${category.name} is now ${category.isVisible ? "hidden" : "visible"}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const affected = linkCounts.get(deleteTarget.id) ?? 0;
    const ok = await deleteCategory(deleteTarget.id);
    if (!ok) return;
    toast.success(
      affected > 0
        ? `Category deleted; ${affected} link${affected === 1 ? "" : "s"} kept`
        : "Category deleted",
    );
    setDeleteTarget(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const category = state.categories.find((item) => item.id === active.id);
    if (!category) return;
    const ok = await reorderCategories(String(active.id), String(over.id));
    if (!ok) return;
    setDragMessage(`${category.name} moved. Order saved.`);
    toast.success("Category order saved");
  };

  const handleKeyboardMove = async (category: Category, direction: -1 | 1) => {
    const index = state.categories.findIndex((item) => item.id === category.id);
    if (index === -1) return;
    const target = state.categories[index + direction];
    if (!target) return;
    const ok = await reorderCategories(category.id, target.id);
    if (!ok) return;
    setDragMessage(
      `${category.name} moved to position ${index + direction + 1}. Order saved.`,
    );
    setFocusHandleId(category.id);
  };

  const deleteCount = deleteTarget ? linkCounts.get(deleteTarget.id) ?? 0 : 0;

  return (
    <DashboardFrame preview={<DashboardPreview title="Preview on your profile" />}>
      <PageHeader
        title="Categories"
        description="Organize your links into categories to keep your profile clean and easy to navigate."
        actions={
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Add category
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total categories" value={state.categories.length} icon={Folder} />
        <StatCard
          label="Links in categories"
          value={categorizedLinks}
          sub={`${uncategorizedCount} uncategorized`}
          icon={Link2}
        />
        <StatCard label="Visible categories" value={visibleCount} icon={Eye} />
        <StatCard label="Hidden categories" value={hiddenCount} icon={EyeOff} />
      </div>

      <p className="mb-2 text-xs text-zinc-600" aria-live="polite">
        {dragMessage ||
          (canDrag
            ? "Drag a handle to change the order categories appear on your profile. Keyboard: focus a handle and press ↑ / ↓."
            : "Add another category to enable reordering.")}
      </p>

      {state.categories.length === 0 ? (
        <Card className="p-10 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-700">
            <Folder aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-zinc-900">No categories yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-600">
            Group related links so visitors can scan your profile more easily.
          </p>
          <Button onClick={openAdd} className="mt-5">
            <Plus className="size-4" /> Add your first category
          </Button>
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
            items={state.categories.map((category) => category.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-3" aria-label="Categories">
              {state.categories.map((category) => (
                <SortableCategoryRow
                  key={category.id}
                  category={category}
                  linkCount={linkCounts.get(category.id) ?? 0}
                  canDrag={canDrag}
                  onToggle={(category) => {
                    void handleToggle(category);
                  }}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                  onKeyboardMove={(category, direction) => {
                    void handleKeyboardMove(category, direction);
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {state.categories.length >= LIMITS.maxCategories ? (
        <p className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-600">
          You&apos;ve reached the {LIMITS.maxCategories}-category limit. Delete a category before
          adding another.
        </p>
      ) : null}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        category={editing}
        categories={state.categories}
        categoryCount={state.categories.length}
        onSubmit={(values) => {
          void handleSubmit(values);
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
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  Delete &ldquo;{deleteTarget.name}&rdquo;?{" "}
                  {deleteCount > 0 ? (
                    <>
                      <strong className="font-semibold text-zinc-800">
                        {deleteCount} link{deleteCount === 1 ? "" : "s"} will become
                        uncategorized, not deleted.
                      </strong>{" "}
                      They&apos;ll appear under &ldquo;Other links&rdquo; on your profile.
                    </>
                  ) : (
                    "This category has no links. This can't be undone."
                  )}
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
              Delete category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardFrame>
  );
}
