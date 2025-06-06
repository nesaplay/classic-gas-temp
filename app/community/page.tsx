"use client";

import React from "react";
import {
  Users,
  MessageSquare,
  Heart,
  MessageCircle as MessageCircleIcon,
  PlayCircle,
  Instagram,
  Youtube,
  Twitter,
  Share2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-2.43.05-4.84-.94-6.37-2.96-2.06-2.71-2.45-6.21-1.39-9.12 1.01-2.78 3.18-5.01 6.04-6.01.62-.21 1.25-.38 1.88-.5.02 1.48-.04 2.96-.04 4.44-.99.32-2.15.25-3.02-.38-.87-.62-1.34-1.64-1.39-2.75-.02-1.11.42-2.13 1.16-2.85.98-.94 2.44-1.25 3.82-1.03z"></path>
  </svg>
);

const mockReels = [
  {
    id: 1,
    thumbnailUrl: "https://images.pexels.com/photos/120049/pexels-photo-120049.jpeg?auto=compress&cs=tinysrgb&w=600",
    user: { name: "@ClassicRides", avatarUrl: "https://i.pravatar.cc/150?u=a" },
    caption: "Sunset cruise in the '65 Mustang. Pure bliss.",
    likes: "15.2k",
    comments: "876",
  },
  {
    id: 2,
    thumbnailUrl: "https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&cs=tinysrgb&w=600",
    user: { name: "@TunerLife", avatarUrl: "https://i.pravatar.cc/150?u=b" },
    caption: "Engine bay is finally clean! What's next? #2JZ",
    likes: "22.5k",
    comments: "1.2k",
  },
  {
    id: 3,
    thumbnailUrl: "https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg?auto=compress&cs=tinysrgb&w=600",
    user: {
      name: "@VintageVibes",
      avatarUrl: "https://i.pravatar.cc/150?u=c",
    },
    caption: "Restoring this beauty! '67 Fastback.",
    likes: "18.1k",
    comments: "952",
  },
  {
    id: 4,
    thumbnailUrl: "https://images.pexels.com/photos/707046/pexels-photo-707046.jpeg?auto=compress&cs=tinysrgb&w=600",
    user: { name: "@DriftKing", avatarUrl: "https://i.pravatar.cc/150?u=d" },
    caption: "Weekend track day fun!",
    likes: "30.7k",
    comments: "2.3k",
  },
  {
    id: 5,
    thumbnailUrl: "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=600",
    user: {
      name: "@EuroSpec",
      avatarUrl: "https://i.pravatar.cc/150?u=e",
    },
    caption: "Mountain roads and this beast.",
    likes: "12.9k",
    comments: "643",
  },
  {
    id: 6,
    thumbnailUrl: "https://images.pexels.com/photos/919073/pexels-photo-919073.jpeg?auto=compress&cs=tinysrgb&w=600",
    user: { name: "@JDM_Dreams", avatarUrl: "https://i.pravatar.cc/150?u=f" },
    caption: "My pride and joy. #R34",
    likes: "45.1k",
    comments: "3.1k",
  },
  {
    id: 7,
    thumbnailUrl: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=600",
    user: {
      name: "@PaintPros",
      avatarUrl: "https://i.pravatar.cc/150?u=g",
    },
    caption: "Fresh paint job, what do you think?",
    likes: "8.8k",
    comments: "501",
  },
  {
    id: 8,
    thumbnailUrl: "https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=600",
    user: {
      name: "@OffroadAdventures",
      avatarUrl: "https://i.pravatar.cc/150?u=h",
    },
    caption: "Getting muddy!",
    likes: "7.2k",
    comments: "432",
  },
  {
    id: 9,
    thumbnailUrl: "https://images.pexels.com/photos/244206/pexels-photo-244206.jpeg?auto=compress&cs=tinysrgb&w=600",
    user: {
      name: "@SupercarSpotter",
      avatarUrl: "https://i.pravatar.cc/150?u=i",
    },
    caption: "Spotted this gem today.",
    likes: "25.4k",
    comments: "1.5k",
  },
  {
    id: 10,
    thumbnailUrl: "https://images.pexels.com/photos/164634/pexels-photo-164634.jpeg?auto=compress&cs=tinysrgb&w=600",
    user: { name: "@DailyDriven", avatarUrl: "https://i.pravatar.cc/150?u=j" },
    caption: "My daily driver. Love this car.",
    likes: "5.6k",
    comments: "321",
  },
];

const ReelCard = ({ reel }: { reel: (typeof mockReels)[0] }) => (
  <div className="break-inside-avoid mb-4">
    <Card className="overflow-hidden group relative">
      <img
        src={reel.thumbnailUrl}
        alt={reel.caption}
        className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300" />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <PlayCircle className="h-16 w-16 text-white/80" />
      </div>
      <div className="absolute bottom-0 left-0 p-4 bg-gradient-to-t from-black/80 to-transparent w-full">
        <div className="flex items-start gap-2">
          <Avatar className="h-10 w-10 border-2 border-white/80">
            <AvatarImage src={reel.user.avatarUrl} alt={reel.user.name} />
            <AvatarFallback>{reel.user.name.charAt(1)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white font-bold text-sm">{reel.user.name}</p>
            <p className="text-white/90 text-sm line-clamp-2">{reel.caption}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-white/90 mt-2">
          <div className="flex items-center gap-1">
            <Heart className="h-5 w-5" />
            <span className="text-xs font-semibold">{reel.likes}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircleIcon className="h-5 w-5" />
            <span className="text-xs font-semibold">{reel.comments}</span>
          </div>
        </div>
      </div>
    </Card>
  </div>
);

const socialPlatforms = [
  {
    platform: "Instagram",
    handle: "@ClassicGasGarage",
    description: "Daily photos, stories, and reels from our garage.",
    icon: <Instagram className="h-8 w-8 text-[#E4405F]" />,
    href: "#",
  },
  {
    platform: "TikTok",
    handle: "@ClassicGas",
    description: "Quick tips, satisfying restorations, and behind-the-scenes.",
    icon: <TikTokIcon className="h-8 w-8 text-foreground" />,
    href: "#",
  },
  {
    platform: "YouTube",
    handle: "Classic Gas",
    description: "In-depth project series, tutorials, and community features.",
    icon: <Youtube className="h-8 w-8 text-[#FF0000]" />,
    href: "#",
  },
  {
    platform: "X (Twitter)",
    handle: "@ClassicGas",
    description: "Live updates, quick polls, and conversations with us.",
    icon: <Twitter className="h-8 w-8 text-[#1DA1F2]" />,
    href: "#",
  },
];

const SocialBoardCard = ({
  platform,
  handle,
  description,
  icon,
  href,
}: {
  platform: string;
  handle: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}) => (
  <Card className="flex flex-col">
    <CardHeader className="flex flex-row items-center gap-4">
      {icon}
      <div>
        <CardTitle>{platform}</CardTitle>
        <CardDescription>{handle}</CardDescription>
      </div>
    </CardHeader>
    <CardContent className="flex-grow">
      <p className="text-sm text-muted-foreground">{description}</p>
    </CardContent>
    <CardFooter>
      <Button asChild variant="outline" className="w-full">
        <a href={href} target="_blank" rel="noopener noreferrer">
          <Share2 className="mr-2 h-4 w-4" />
          View Profile
        </a>
      </Button>
    </CardFooter>
  </Card>
);

export default function CommunityPage() {
  return (
    <div className="bg-muted/40 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3 text-foreground">
            <Users className="h-8 w-8 text-primary" />
            <span>Community Hub</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Join the conversation, share your passion, and connect with fellow enthusiasts.
          </p>
        </header>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-semibold mb-4">From the Community</h2>
            <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4">
              {mockReels.map((reel) => (
                <ReelCard key={reel.id} reel={reel} />
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-2xl font-semibold mb-4">Join the Conversation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-8 w-8" />
                    <CardTitle className="text-2xl">Join our Discord</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="opacity-90">
                    Chat with experts and fellow enthusiasts in real-time. Share your project, ask questions, and get
                    instant feedback from our community.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="secondary" className="w-full sm:w-auto">
                    Launch Discord
                  </Button>
                </CardFooter>
              </Card>
              <div className="space-y-4">
                {socialPlatforms.slice(0, 2).map((platform) => (
                  <SocialBoardCard key={platform.platform} {...platform} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {socialPlatforms.slice(2).map((platform) => (
                <SocialBoardCard key={platform.platform} {...platform} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
