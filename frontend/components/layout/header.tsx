"use client";

import Link from "next/link";
import { Car, Menu, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { PROJECT_CONFIG } from "@/lib/constants";
import { useEffect, useState } from "react";
import { useAiProcessingStore, AiProcessingStatus } from "@/lib/store/useAiProcessingStore"; // Adjust path if needed
import { Button } from "@/components/ui/button";

export function Header() {
  const {
    jobId,
    status,
    processedCount,
    totalToProcess,
    errorMessage,
    updateJobProgress,
    completeJob,
    failJob,
    resetJob,
  } = useAiProcessingStore();

  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [showFailureMessage, setShowFailureMessage] = useState(false);

  useEffect(() => {
    // Helper to determine if polling should continue
    const isActiveProcessingStatus = (s: AiProcessingStatus): boolean => {
      return (
        s === "pending" ||
        s === "active_categorizing" ||
        s === "active_prioritizing" ||
        s === "processing_complete_pending_final_count"
      ); // Continue polling for this status
    };

    if (jobId && isActiveProcessingStatus(status)) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/ai/processing-status?jobId=${jobId}`);
          // console.log('[Header Polling] Raw response status:', response.status);
          if (!response.ok) {
            const errorData = await response
              .json()
              .catch(() => ({ error: "Failed to fetch status and parse error json" }));
            console.error("[Header Polling] Error fetching status:", response.status, errorData);
            // Potentially update store with a generic fetch error if appropriate
            // For now, let specific failJob calls handle it based on error type from backend.
            if (response.status === 404) {
              failJob("failed_unknown", errorData.error || "Processing job not found. Polling stopped.");
            } else {
              // Keep polling unless it's a definitive non-recoverable error from server for this job
              // failJob('failed_unknown', errorData.error || `API Error: ${response.status}. Polling may continue if job active.`);
            }
            return; // Don't proceed with parsing if response not ok
          }
          const data = await response.json();
          // console.log('[Header Polling] Received data for job:', jobId, data);

          // Data from /api/ai/processing-status: { status, processed_emails, total_emails, error_message? }
          // The store's updateJobProgress will handle transitioning to 'completed' if counts match.
          if (data.status.startsWith("failed")) {
            failJob(data.status as AiProcessingStatus, data.error_message || "AI Processing failed from backend");
          } else if (data.status === "completed") {
            completeJob(data.processed_emails); // Backend confirms completion
          } else {
            // For any other status (pending, active_*, processing_complete_pending_final_count),
            // update progress. Store logic might promote to 'completed' if counts align.
            updateJobProgress(data.processed_emails, data.status as AiProcessingStatus);
          }
        } catch (error) {
          console.error("[Header] Error during polling AI processing status:", error);
          // Potentially set a specific error state in the store if polling itself catastrophically fails
          // failJob('failed_unknown', error instanceof Error ? error.message : "Polling network/parse error");
          // For now, we let it retry or rely on next successful poll.
        }
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    }
  }, [jobId, status, updateJobProgress, completeJob, failJob, resetJob]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === "completed") {
      setShowCompletionMessage(true);
      timer = setTimeout(() => {
        setShowCompletionMessage(false);
        resetJob();
      }, 5000);
    }
    if (status.startsWith("failed")) {
      setShowFailureMessage(true);
      timer = setTimeout(() => {
        setShowFailureMessage(false);
        resetJob();
      }, 8000);
    }
    return () => clearTimeout(timer);
  }, [status, resetJob]);

  const isProcessing =
    status === "pending" ||
    status === "active_categorizing" ||
    status === "active_prioritizing" ||
    status === "processing_complete_pending_final_count";

  const progressPercent = totalToProcess > 0 ? (processedCount / totalToProcess) * 100 : 0;

  return (
    <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <img src="/icons/header-icon.svg" alt="Header Icon" className="h-8 w-8" />
        </Link>
        <nav className="hidden md:flex space-x-4">
          <Link href="/community" className="text-sm font-medium hover:text-primary">
            Community
          </Link>
          <Link href="/car-upgrades" className="text-sm font-medium hover:text-primary">
            Car Upgrades
          </Link>
          <Link href="/sourcing-and-planning" className="text-sm font-medium hover:text-primary">
            Sourcing and Planning
          </Link>
          <Link href="/talk-to-experts" className="text-sm font-medium hover:text-primary">
            Talk to Experts
          </Link>
          <Link href="/settings" className="text-sm font-medium hover:text-primary">
            Settings
          </Link>
        </nav>
        <ThemeToggle />
      </div>
      {isProcessing && totalToProcess > 0 && (
        <div className="w-full bg-muted">
          <div
            className="bg-primary h-1 text-xs text-primary-foreground text-center leading-none transition-all duration-300 ease-linear"
            style={{ width: `${Math.min(progressPercent, 100)}%` }} // Cap at 100%
          ></div>
          <p className="text-xs text-center text-muted-foreground py-0.5">
            AI Processing: {processedCount} / {totalToProcess} emails (
            {status
              .replace("active_", "")
              .replace("processing_complete_pending_final_count", "finalizing")
              .replace("_", " ")
              .replace("pending", "initializing")}
            )
          </p>
        </div>
      )}
      {showCompletionMessage && status === "completed" && (
        <div className="w-full bg-green-500 text-white text-xs text-center py-1">
          Email processing completed successfully!
        </div>
      )}
      {showFailureMessage && status.startsWith("failed") && (
        <div className="w-full bg-destructive text-destructive-foreground text-xs text-center py-1">
          Email processing failed: {errorMessage || "An unknown error occurred."}
        </div>
      )}
    </header>
  );
}
