import type { ReactNode, TableHTMLAttributes } from "react";

const cn = (...classes: Array<string | undefined>) =>
  classes.filter(Boolean).join(" ");

export type DataTableColumn = {
  className?: string;
  heading: ReactNode;
  key: string;
};

export interface DataTableProps extends TableHTMLAttributes<HTMLTableElement> {
  bodyClassName?: string;
  children: ReactNode;
  columnHeaderClassName?: string;
  columns: DataTableColumn[];
  emptyCellClassName?: string;
  emptyMessage?: ReactNode;
  headerRowClassName?: string;
  isEmpty?: boolean;
  minWidthClassName?: string;
  textSizeClassName?: string;
  wrapperClassName?: string;
}

export function DataTable({
  bodyClassName = "divide-y divide-background-secondary",
  children,
  className,
  columnHeaderClassName = "bg-card-bg-primary px-4 py-3.5 text-sm font-semibold tracking-wider text-txt-primary",
  columns,
  emptyCellClassName = "px-4 py-8 text-center text-txt-secondary",
  emptyMessage,
  headerRowClassName = "divide-x divide-background-secondary border-b-2 border-txt-primary bg-card-bg-primary text-txt-primary",
  isEmpty = false,
  minWidthClassName = "min-w-[1040px]",
  textSizeClassName = "text-base",
  wrapperClassName = "overflow-x-auto px-5 py-5",
  ...props
}: DataTableProps) {
  return (
    <div className={wrapperClassName}>
      <table
        className={cn(
          "w-full border border-background-secondary border-collapse text-left",
          minWidthClassName,
          textSizeClassName,
          className,
        )}
        {...props}
      >
        <thead>
          <tr className={headerRowClassName}>
            {columns.map((column) => (
              <th
                className={cn(columnHeaderClassName, column.className)}
                key={column.key}
              >
                {column.heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={bodyClassName}>
          {isEmpty ? (
            <tr>
              <td className={emptyCellClassName} colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
