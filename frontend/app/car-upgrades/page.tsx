"use client"

import React, { useState } from "react"
import { Car, Wrench, FileText, HelpCircle, ListChecks } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// Schemas for form validation
const intakeFormSchema = z.object({
  make: z.string().min(2, { message: "Make must be at least 2 characters." }),
  model: z.string().min(2, { message: "Model must be at least 2 characters." }),
  year: z.coerce.number().min(1900).max(new Date().getFullYear() + 1),
  vin: z.string().length(17).or(z.literal("")),
  description: z.string().max(500).optional(),
})

const upgradesSchema = z.object({
  engine: z.array(z.string()).optional(),
  suspension: z.array(z.string()).optional(),
  audio: z.array(z.string()).optional(),
  other: z.string().optional(),
})

// Data types
type IntakeFormData = z.infer<typeof intakeFormSchema>
type UpgradesFormData = z.infer<typeof upgradesSchema>

// Sub-components for each step
const IntakeForm = ({
  onSave,
  initialData,
}: {
  onSave: (data: IntakeFormData) => void
  initialData: Partial<IntakeFormData>
}) => {
  const form = useForm<IntakeFormData>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: initialData,
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="make"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Make</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Buick" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Grand National" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. 1987" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>VIN</FormLabel>
                <FormControl>
                  <Input placeholder="17-digit VIN" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>History / Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us about your car's history, condition, and your goals."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save and Continue</Button>
      </form>
    </Form>
  )
}

const upgradeOptions = {
  engine: [
    { id: "fuel_injectors", label: "Fuel Injectors" },
    { id: "turbo", label: "Turbocharger" },
    { id: "exhaust", label: "Performance Exhaust" },
  ],
  suspension: [
    { id: "coilovers", label: "Coilovers" },
    { id: "sway_bars", label: "Sway Bars" },
  ],
  audio: [
    { id: "speakers", label: "Speakers" },
    { id: "subwoofer", label: "Subwoofer" },
    { id: "head_unit", label: "Modern Head Unit" },
  ],
}

const SelectUpgrades = ({
  onSave,
  initialData,
}: {
  onSave: (data: UpgradesFormData) => void
  initialData: Partial<UpgradesFormData>
}) => {
  const form = useForm<UpgradesFormData>({
    resolver: zodResolver(upgradesSchema),
    defaultValues: initialData,
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-6 p-4">
        {Object.entries(upgradeOptions).map(([category, options]) => (
          <FormField
            key={category}
            control={form.control}
            name={category as keyof UpgradesFormData}
            render={() => (
              <FormItem>
                <div className="mb-4">
                  <FormLabel className="text-base capitalize">{category}</FormLabel>
                  <FormDescription>
                    Select the {category} upgrades you're interested in.
                  </FormDescription>
                </div>
                {options.map(item => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name={category as keyof UpgradesFormData}
                    render={({ field }) => (
                      <FormItem
                        key={item.id}
                        className="flex flex-row items-start space-x-3 space-y-0"
                      >
                        <FormControl>
                          <Checkbox
                            checked={
                              Array.isArray(field.value) &&
                              field.value.includes(item.id)
                            }
                            onCheckedChange={checked => {
                              const currentValue = Array.isArray(field.value)
                                ? field.value
                                : []
                              if (checked) {
                                field.onChange([...currentValue, item.id])
                              } else {
                                field.onChange(
                                  currentValue.filter(
                                    (value: string) => value !== item.id,
                                  ),
                                )
                              }
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {item.label}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </FormItem>
            )}
          />
        ))}
        <FormField
          control={form.control}
          name="other"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Other Requests</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any other specific requests or parts?"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save and Continue</Button>
      </form>
    </Form>
  )
}

const QASection = () => (
  <div className="p-4">
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>
          How long does the upgrade process take?
        </AccordionTrigger>
        <AccordionContent>
          The timeline varies depending on the complexity of the upgrades and
          parts availability. A basic upgrade might take a week, while a full
          restoration can take several months.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Can I supply my own parts?</AccordionTrigger>
        <AccordionContent>
          Yes, you can. However, we cannot warranty customer-supplied parts or
          any issues that arise from their installation. We recommend using
          parts sourced through our trusted suppliers.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>What is the cost?</AccordionTrigger>
        <AccordionContent>
          Cost is highly variable. We will provide a detailed quote after you
          have completed the intake and upgrade selection forms. The summary
          step will include a preliminary cost estimate.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
)

const Summary = ({
  carData,
  upgradeData,
}: {
  carData: Partial<IntakeFormData>
  upgradeData: Partial<UpgradesFormData>
}) => (
  <div className="p-4 space-y-4">
    <Card>
      <CardHeader>
        <CardTitle>Car Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p>
          <strong>Make:</strong> {carData.make}
        </p>
        <p>
          <strong>Model:</strong> {carData.model}
        </p>
        <p>
          <strong>Year:</strong> {carData.year}
        </p>
        <p>
          <strong>Description:</strong> {carData.description}
        </p>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>Selected Upgrades</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {upgradeData.engine && upgradeData.engine.length > 0 && (
          <p>
            <strong>Engine:</strong> {upgradeData.engine.join(", ")}
          </p>
        )}
        {upgradeData.suspension && upgradeData.suspension.length > 0 && (
          <p>
            <strong>Suspension:</strong> {upgradeData.suspension.join(", ")}
          </p>
        )}
        {upgradeData.audio && upgradeData.audio.length > 0 && (
          <p>
            <strong>Audio:</strong> {upgradeData.audio.join(", ")}
          </p>
        )}
        {upgradeData.other && (
          <p>
            <strong>Other:</strong> {upgradeData.other}
          </p>
        )}
      </CardContent>
    </Card>
    <Alert>
      <HelpCircle className="h-4 w-4" />
      <AlertTitle>Next Steps</AlertTitle>
      <AlertDescription>
        We will review your submission and get back to you with a detailed quote
        and timeline within 2-3 business days.
      </AlertDescription>
    </Alert>
  </div>
)

export default function CarUpgradesPage() {
  const [steps, setSteps] = useState([
    {
      id: "consultation",
      icon: HelpCircle,
      title: "Tell us about your car",
      description: "Initial consultation and follow-ups.",
      status: "Completed",
      user: "AI Assistant",
      lastUpdate: "2m ago",
      action: "View",
    },
    {
      id: "intake",
      icon: FileText,
      title: "Intake form for the car",
      description: "Fill out the details for your classic vehicle.",
      status: "Next Up",
      user: "You",
      lastUpdate: "now",
      action: "Start",
    },
    {
      id: "upgrades",
      icon: Wrench,
      title: "Select type of upgrades",
      description: "e.g. fuel injectors, speakers",
      status: "Locked",
      user: "",
      lastUpdate: "",
      action: "View",
    },
    {
      id: "qa",
      icon: HelpCircle,
      title: "Q&A",
      description: "Ask questions about the upgrade process.",
      status: "Locked",
      user: "",
      lastUpdate: "",
      action: "View",
    },
    {
      id: "summary",
      icon: ListChecks,
      title: "Summary of next steps",
      description: "Review your upgrade plan and quote.",
      status: "Locked",
      user: "",
      lastUpdate: "",
      action: "View",
    },
  ])

  const [openSection, setOpenSection] = useState<string | null>("intake")
  const [carData, setCarData] = useState<Partial<IntakeFormData>>({
    make: "Buick",
    model: "Grand National",
    year: 1987,
  })
  const [upgradeData, setUpgradeData] = useState<Partial<UpgradesFormData>>({})

  const updateStepStatus = (
    stepId: string,
    status: "Completed" | "Next Up" | "Locked",
  ) => {
    setSteps(currentSteps =>
      currentSteps.map(step => (step.id === stepId ? { ...step, status } : step)),
    )
  }

  const handleIntakeSave = (data: IntakeFormData) => {
    setCarData(data)
    updateStepStatus("intake", "Completed")
    updateStepStatus("upgrades", "Next Up")
    setOpenSection("upgrades")
  }

  const handleUpgradesSave = (data: UpgradesFormData) => {
    setUpgradeData(data)
    updateStepStatus("upgrades", "Completed")
    updateStepStatus("qa", "Next Up")
    updateStepStatus("summary", "Next Up")
    setOpenSection("summary")
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Completed":
        return "default"
      case "Next Up":
        return "secondary"
      case "Locked":
        return "outline"
      default:
        return "default"
    }
  }

  const renderSectionContent = (stepId: string) => {
    switch (stepId) {
      case "intake":
        return <IntakeForm onSave={handleIntakeSave} initialData={carData} />
      case "upgrades":
        return (
          <SelectUpgrades onSave={handleUpgradesSave} initialData={upgradeData} />
        )
      case "qa":
        return <QASection />
      case "summary":
        return <Summary carData={carData} upgradeData={upgradeData} />
      default:
        return (
          <div className="p-4 text-muted-foreground">
            This section is for informational purposes.
          </div>
        )
    }
  }

  return (
    <div className="bg-muted/40 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3 text-foreground">
            <Car className="h-8 w-8 text-primary" />
            <span>Car Upgrades</span>
      </h1>
          <p className="text-muted-foreground mt-1">
            A step-by-step process for upgrading your beloved classic.
          </p>
        </header>

        <Card>
            <CardHeader>
            <CardTitle>Upgrade Forum</CardTitle>
            <CardDescription>
              Follow the steps below to begin your car's transformation.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="divide-y divide-border">
              {steps.map(step => (
                <div key={step.id}>
                  <div
                    className={cn(
                      "flex items-center justify-between p-4 transition-colors hover:bg-muted/50",
                      step.status !== "Locked" && "cursor-pointer",
                    )}
                    onClick={() =>
                      step.status !== "Locked" &&
                      setOpenSection(openSection === step.id ? null : step.id)
                    }
                  >
                    <div className="flex items-center gap-4">
                      <step.icon className="h-7 w-7 text-muted-foreground" />
                      <div className="grid gap-1">
                        <p className="font-semibold">{step.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="w-40 text-sm text-muted-foreground text-right hidden md:block">
                        {step.user && (
                          <div className="flex items-center justify-end gap-2 font-medium">
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${step.user}`}
                              />
                              <AvatarFallback>
                                {step.user.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{step.user}</span>
                          </div>
                        )}
                        {step.lastUpdate && <p>{step.lastUpdate}</p>}
                      </div>
                      <Badge variant={getStatusVariant(step.status)}>
                        {step.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={e => {
                          e.stopPropagation()
                          if (step.status !== "Locked") {
                            setOpenSection(
                              openSection === step.id ? null : step.id,
                            )
                          }
                        }}
                      >
                        {openSection === step.id ? "Close" : step.action}
                      </Button>
                    </div>
                  </div>
                  {openSection === step.id && (
                    <div className="bg-muted/20">
                      {renderSectionContent(step.id)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            </CardContent>
          </Card>
      </div>
    </div>
  )
}
