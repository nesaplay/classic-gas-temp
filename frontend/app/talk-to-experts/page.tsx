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
  Phone,
  MessageSquare,
  Video,
  CheckCircle,
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
  CardFooter,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "@/components/ui/dialog"

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

const experts = [
    {
      name: "John 'Turbo' Smith",
      avatar: "https://i.pravatar.cc/150?u=steven",
      specialty: "Engine Tuning & Performance",
      bio: "With 20+ years in motorsports, John can help you squeeze every bit of power from your engine.",
      agenda: [
        "Initial Goal Setting & Feasibility",
        "Component Selection & Sourcing",
        "Tuning & Dyno Preparation",
      ],
      rate: "30 mins free",
    },
    {
      name: "Maria Garcia",
      avatar: "https://i.pravatar.cc/150?u=mariagarcia",
      specialty: "Classic Car Restoration",
      bio: "Passionate about preserving automotive history, Maria specializes in period-correct restorations.",
      agenda: [
        "Project Assessment & Authenticity",
        "Bodywork & Paint Strategy",
        "Sourcing Rare & Original Parts",
      ],
      rate: "30 mins free",
    },
    {
      name: "David Chen",
      avatar: "https://i.pravatar.cc/150?u=mike",
      specialty: "Suspension & Handling",
      bio: "An automotive engineer who lives for the perfect corner. David can make your classic handle like a modern sports car.",
       agenda: [
        "Handling Goals (Street, Track, etc.)",
        "Suspension Geometry & Setup",
        "Tire & Wheel Combination Advice",
      ],
      rate: "30 mins free",
    },
]

const timeSlots = ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"]

const SchedulingDialog = ({ expert }: { expert: (typeof experts)[0]}) => {
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [selectedTime, setSelectedTime] = useState<string | null>(null)

    return (
        <DialogContent className="sm:max-w-[650px]">
            <DialogHeader>
            <DialogTitle>Schedule a call with {expert.name}</DialogTitle>
            <DialogDescription>
                Select a date and time for your 30-minute consultation. The first 30 minutes are free.
            </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                <div className="flex justify-center">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        className="rounded-md border"
                        disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))}
                    />
                </div>
                <div className="space-y-4">
                    <h4 className="font-semibold">Available Time Slots</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {timeSlots.map(time => (
                            <Button key={time} variant={selectedTime === time ? "default" : "outline"} onClick={() => setSelectedTime(time)}>
                                {time}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
             <Card className="mt-4 bg-secondary">
                <CardHeader>
                    <CardTitle className="text-lg">Free to Paid Model</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Your initial 30-minute session is complimentary. If you wish to continue the discussion, the expert will provide you with their hourly rates and payment details during the call.
                    </p>
                </CardContent>
            </Card>
            <Button className="mt-4 w-full" disabled={!date || !selectedTime}>
                Confirm Call for {date?.toLocaleDateString()} at {selectedTime}
            </Button>
        </DialogContent>
    )
}

export default function TalkToExpertsPage() {
  return (
    <div className="bg-muted/40 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3 text-foreground">
            <Phone className="h-8 w-8 text-primary" />
            <span>Talk to Experts</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Schedule a one-on-one call with our seasoned car specialists.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <div className="grid gap-6">
                 {experts.map((expert) => (
                    <Dialog key={expert.name}>
                        <Card className="overflow-hidden">
                        <div className="flex flex-col sm:flex-row">
                            <div className="flex-shrink-0 p-4 sm:p-6 flex items-center justify-center bg-muted/50">
                                <Avatar className="h-24 w-24 border-4 border-background">
                                    <AvatarImage src={expert.avatar} alt={expert.name} />
                                    <AvatarFallback>{expert.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="flex-1">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-xl">{expert.name}</CardTitle>
                                        <Badge variant="secondary">{expert.specialty}</Badge>
                                    </div>
                                    <CardDescription>{expert.bio}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <h4 className="font-semibold mb-2">30-Min Structured Call:</h4>
                                    <ul className="space-y-1 text-sm text-muted-foreground">
                                        {expert.agenda.map((item, i) => (
                                            <li key={i} className="flex items-start">
                                                <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-primary flex-shrink-0" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter className="bg-muted/30 p-4">
                                    <DialogTrigger asChild>
                                        <Button className="w-full sm:w-auto">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            Schedule ({expert.rate})
                                        </Button>
                                    </DialogTrigger>
                                </CardFooter>
                            </div>
                        </div>
                        </Card>
                        <SchedulingDialog expert={expert} />
                    </Dialog>
                ))}
                </div>
            </div>
            <div className="space-y-8">
                <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <MessageSquare className="h-8 w-8"/>
                            <CardTitle className="text-2xl">Join our Discord</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="opacity-90">
                            Chat with experts and fellow enthusiasts in real-time. Share your project, ask questions, and get instant feedback from our community.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <Button variant="secondary" className="w-full">
                           Join the Community
                        </Button>
                    </CardFooter>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>How it Works</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-muted-foreground">
                       <p><strong>1. Choose an Expert:</strong> Browse our specialists and find the right fit for your project.</p>
                       <p><strong>2. Schedule a Call:</strong> Pick a date and time that works for you. Your first 30 minutes are on us!</p>
                       <p><strong>3. Talk it Out:</strong> Connect with your expert via a video call to discuss your project in detail.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </div>
  )
}
