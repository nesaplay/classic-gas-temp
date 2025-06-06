"use client"

import React, { useState } from "react"
import {
  Wrench,
  ShoppingCart,
  CalendarClock,
  Users,
  CircleDollarSign,
  Info,
  MapPin,
  Calendar as CalendarIcon,
  PlusCircle,
  XCircle,
} from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import * as z from "zod"
import { format } from "date-fns"
import { DateRange } from "react-day-picker"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

// Schemas
const upgradeInfoSchema = z.object({
  title: z
    .string()
    .min(5, { message: "Title must be at least 5 characters." }),
  description: z.string().max(500).optional(),
})

const purchasingSitesSchema = z.object({
  sites: z.array(
    z.object({
      url: z.string().url({ message: "Please enter a valid URL." }),
    }),
  ),
})

const costTimelineSchema = z
  .object({
    cost: z.coerce.number().min(0, "Cost must be a positive number."),
    timeline: z.object({
      from: z.date({ required_error: "A start date is required." }),
      to: z.date({ required_error: "An end date is required." }),
    }),
  })
  .refine(data => data.timeline.to > data.timeline.from, {
    message: "End date must be after start date.",
    path: ["timeline"],
  })

// Data Types
type UpgradeInfoData = z.infer<typeof upgradeInfoSchema>
type PurchasingSitesData = z.infer<typeof purchasingSitesSchema>
type CostTimelineData = z.infer<typeof costTimelineSchema>

// Sub-components
const UpgradeInfoForm = ({ onSave }: { onSave: (data: UpgradeInfoData) => void }) => {
  const form = useForm<UpgradeInfoData>({
    resolver: zodResolver(upgradeInfoSchema),
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-6 p-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Upgrade Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Turbocharger & Fuel System Overhaul" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the main goals of this upgrade."
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

const PurchasingSitesForm = ({ onSave }: { onSave: (data: PurchasingSitesData) => void }) => {
  const form = useForm<PurchasingSitesData>({
    resolver: zodResolver(purchasingSitesSchema),
    defaultValues: { sites: [{ url: "" }] },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "sites",
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-6 p-4">
        {fields.map((field, index) => (
          <FormField
            key={field.id}
            control={form.control}
            name={`sites.${index}.url`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchasing Site URL</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input placeholder="https://www.parts-supplier.com" {...field} />
                  </FormControl>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                  >
                    <XCircle className="h-5 w-5 text-destructive" />
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
         <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ url: '' })}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add URL
          </Button>
        <Button type="submit">Save and Continue</Button>
      </form>
    </Form>
  )
}

const CostTimelineForm = ({ onSave }: { onSave: (data: CostTimelineData) => void }) => {
  const form = useForm<CostTimelineData>({
    resolver: zodResolver(costTimelineSchema),
  })

  const [date, setDate] = React.useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-6 p-4">
        <FormField
          control={form.control}
          name="cost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estimated Cost ($)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="e.g. 5000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="timeline"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Project Timeline</FormLabel>
               <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "justify-start text-left font-normal",
                      !field.value?.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value?.from ? (
                      field.value.to ? (
                        <>
                          {format(field.value.from, "LLL dd, y")} -{" "}
                          {format(field.value.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(field.value.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{from: field.value?.from, to: field.value?.to}}
                    onSelect={(range) => field.onChange(range)}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save and Continue</Button>
      </form>
    </Form>
  )
}

const localServices = [
    { name: "Classic Auto Repair", specialty: "Engine & Mechanical", distance: "2.5 miles" },
    { name: "The Body Shop", specialty: "Bodywork & Paint", distance: "3.1 miles" },
    { name: "Custom Upholstery Pros", specialty: "Interior & Upholstery", distance: "4.0 miles" },
];

const ContactsSection = () => (
    <div className="p-4 space-y-4">
        <h3 className="font-semibold">Local Services Near You</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {localServices.map(service => (
                <Card key={service.name}>
                    <CardHeader>
                        <CardTitle className="text-lg">{service.name}</CardTitle>
                        <CardDescription>{service.specialty}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="mr-2 h-4 w-4" />
                            <span>{service.distance} away</span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
        <div className="pt-4">
             <img src="https://storage.googleapis.com/proudcity/mebanenc/uploads/2021/03/google-map-pins.png" alt="Map of local services" className="rounded-lg" />
        </div>
    </div>
)

export default function SourcingAndPlanningPage() {
  const [steps, setSteps] = useState([
    {
      id: "upgradeInfo",
      icon: Info,
      title: "Tell us about your upgrade",
      description: "Describe the upgrade you are planning.",
      status: "Next Up",
    },
    {
      id: "purchasing",
      icon: ShoppingCart,
      title: "Purchasing Sites",
      description: "List the sites for purchasing parts.",
      status: "Locked",
    },
    {
      id: "costTimeline",
      icon: CalendarClock,
      title: "Cost & Timeline",
      description: "Estimate the project cost and duration.",
      status: "Locked",
    },
    {
      id: "contacts",
      icon: Users,
      title: "Contacts (Local Services)",
      description: "Find local services for your upgrade.",
      status: "Locked",
    },
  ])

  const [openSection, setOpenSection] = useState<string | null>("upgradeInfo")
  const [upgradeInfo, setUpgradeInfo] = useState<Partial<UpgradeInfoData>>({})
  const [purchasingSites, setPurchasingSites] = useState<Partial<PurchasingSitesData>>({})
  const [costTimeline, setCostTimeline] = useState<Partial<CostTimelineData>>({})

  const updateStepStatus = (stepId: string, status: "Completed" | "Next Up" | "Locked") => {
    setSteps(currentSteps =>
      currentSteps.map(step => (step.id === stepId ? { ...step, status } : step)),
    )
  }

  const handleUpgradeInfoSave = (data: UpgradeInfoData) => {
    setUpgradeInfo(data)
    updateStepStatus("upgradeInfo", "Completed")
    updateStepStatus("purchasing", "Next Up")
    setOpenSection("purchasing")
  }

  const handlePurchasingSitesSave = (data: PurchasingSitesData) => {
    setPurchasingSites(data)
    updateStepStatus("purchasing", "Completed")
    updateStepStatus("costTimeline", "Next Up")
    setOpenSection("costTimeline")
  }

  const handleCostTimelineSave = (data: CostTimelineData) => {
    setCostTimeline(data)
    updateStepStatus("costTimeline", "Completed")
    updateStepStatus("contacts", "Next Up")
    setOpenSection("contacts")
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
      case "upgradeInfo":
        return <UpgradeInfoForm onSave={handleUpgradeInfoSave} />
      case "purchasing":
        return <PurchasingSitesForm onSave={handlePurchasingSitesSave} />
      case "costTimeline":
        return <CostTimelineForm onSave={handleCostTimelineSave} />
      case "contacts":
        return <ContactsSection />
      default:
        return null
    }
  }

  return (
    <div className="bg-muted/40 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3 text-foreground">
            <Wrench className="h-8 w-8 text-primary" />
            <span>Sourcing and Planning</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Plan your car upgrade project from parts to timeline.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Project Planner</CardTitle>
            <CardDescription>
              Complete each step to build your project plan.
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
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <Badge variant={getStatusVariant(step.status)}>
                        {step.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={step.status === "Locked"}
                      >
                        {openSection === step.id ? "Close" : "Open"}
                      </Button>
                    </div>
                  </div>
                  {openSection === step.id && (
                    <div className="bg-muted/20 border-t">
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
