"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { User, Bell, Car, Brush, LogOut, ShieldX } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>
      <Separator />

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            This is how others will see you on the site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
              <AvatarFallback>
                <User className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <Button>Change Photo</Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" placeholder="Your username" defaultValue="john.doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="Your email" defaultValue="john.doe@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" placeholder="Tell us a little about yourself and your cars." />
          </div>
        </CardContent>
      </Card>

      {/* Garage Settings */}
      <Card>
        <CardHeader>
          <CardTitle>My Garage</CardTitle>
          <CardDescription>
            Manage your collection of cars.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center space-x-4 p-4 border rounded-md">
                <Car className="h-6 w-6" />
                <div className="flex-grow">
                    <p className="font-semibold">1998 Toyota Supra</p>
                    <p className="text-sm text-muted-foreground">The legend.</p>
                </div>
                <Button variant="outline" size="sm">Edit</Button>
            </div>
            <div className="flex items-center space-x-4 p-4 border rounded-md">
                <Car className="h-6 w-6" />
                <div className="flex-grow">
                    <p className="font-semibold">2021 Honda Civic Type R</p>
                    <p className="text-sm text-muted-foreground">Daily driver.</p>
                </div>
                <Button variant="outline" size="sm">Edit</Button>
            </div>
          <Button>Add New Car</Button>
        </CardContent>
      </Card>


      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Manage how you receive notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <Label htmlFor="comments-notifications">Comments</Label>
            </div>
            <Switch id="comments-notifications" defaultChecked />
          </div>
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <Label htmlFor="likes-notifications">Likes</Label>
            </div>
            <Switch id="likes-notifications" defaultChecked />
          </div>
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <Label htmlFor="follows-notifications">New Followers</Label>
            </div>
            <Switch id="follows-notifications" />
          </div>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize the look and feel of the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-2">
                <Brush className="h-5 w-5" />
                <Label htmlFor="dark-mode">Dark Mode</Label>
            </div>
            <Switch id="dark-mode" />
          </div>
        </CardContent>
      </Card>
      
      {/* Account Actions */}
       <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Manage your account settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-2">
                <LogOut className="h-5 w-5 text-red-500" />
                <Label htmlFor="logout" className="text-red-500 font-semibold">Logout</Label>
            </div>
            <Button variant="destructive" id="logout">Logout</Button>
          </div>
           <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-2">
                <ShieldX className="h-5 w-5 text-red-500" />
                <Label htmlFor="delete-account" className="text-red-500 font-semibold">Delete Account</Label>
            </div>
            <Button variant="destructive" id="delete-account">Delete</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


