import * as React from "react";
import { cn } from "@/lib/utils";

const List = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, children, ...props }, ref) => {
  return (
    <ul
      ref={ref}
      className={cn(
        "flex flex-col", 
        "divide-y divide-border", // Add divide utility for borders between items
        className
      )} // Basic list styling
      {...props}
    >
      {children}
    </ul>
  );
});
List.displayName = "List";

const ListItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement> & { selected?: boolean }
>(({ className, children, selected, ...props }, ref) => {
  return (
    <li
      ref={ref}
      className={cn(
        "group relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground", // Default hover
        "focus:bg-accent focus:text-accent-foreground", // Default focus (might need adjustment based on usage)
        selected && "bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground focus:bg-secondary focus:text-secondary-foreground", // Selected state
        className
      )}
      {...props}
    >
      {children}
    </li>
  );
});
ListItem.displayName = "ListItem";

export { List, ListItem }; 