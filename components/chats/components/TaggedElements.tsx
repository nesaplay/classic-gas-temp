"use client";

import type React from "react";
import { Badge } from "@/components/ui/badge";
import { X, FileText, TriangleAlert, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMAIL_PRIORITIES } from "@/lib/store/use-email-store";

interface ActiveTag {
  type: 'file' | 'priority' | 'topic';
  value: string;
}

type EmailPriority = typeof EMAIL_PRIORITIES[number];

interface TaggedElementsProps {
  activeTags: ActiveTag[];
  removeTag: (tagToRemove: ActiveTag) => void;
}

const TaggedElements = ({
  activeTags,
  removeTag,
}: TaggedElementsProps) => {
  if (activeTags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 mb-4">
      {activeTags.map((tag, index) => {
        const isPriority = tag.type === 'priority';
        const isTopic = tag.type === 'topic';
        const isFile = tag.type === 'file';

        return (
          <Badge
            key={`${tag.type}-${tag.value}-${index}`}
            variant={isPriority ? "outline" : "secondary"}
            className={cn(
              "pl-2 pr-1 py-0.5 text-xs font-medium",
              (isPriority || isTopic) && "capitalize px-1.5 py-0",
              isFile && "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
            )}
          >
            {isFile && <FileText className="h-3 w-3 mr-1 shrink-0" />}
            {isTopic && <Hash className="h-3 w-3 mr-1 shrink-0" />}
            {isPriority && <TriangleAlert className="h-3 w-3 mr-1 shrink-0" />}

            {tag.type === 'priority' ? tag.value.toLowerCase() : tag.value}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className={cn(
                "p-0.5 rounded-full hover:bg-background/50 focus:outline-none",
                (isPriority || isTopic) ? "ml-1" : "ml-1"
              )}
              aria-label={`Remove ${tag.type} tag: ${tag.value}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}
    </div>
  );
};

export default TaggedElements; 