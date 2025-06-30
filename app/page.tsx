"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ChevronDown, ChevronRight } from "lucide-react";

const MONTH_ORDER = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// TODO: Replace with your GitHub username and repo where GH Action outputs patches
const GITHUB_USER = "ghostbyt3";
const GITHUB_REPO = "patch-tuesday";
const BRANCH = "main";

const baseRawUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/History/`;

export default function PatchTuesday() {
  const [patches, setPatches] = useState<Record<string, string[]>>({});
  const [openYears, setOpenYears] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    fetch(baseRawUrl + "index.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch index.json");
        return res.json();
      })
      .then((data: string[]) => {
        const grouped: Record<string, string[]> = {};
        data.forEach((file) => {
          const year = file.split("-")[0];
          if (!grouped[year]) grouped[year] = [];
          grouped[year].push(file);
        });
        for (const year in grouped) {
          grouped[year].sort((a, b) => {
            const monthA = a.split("-")[1].replace(".txt", "");
            const monthB = b.split("-")[1].replace(".txt", "");
            return MONTH_ORDER.indexOf(monthA) - MONTH_ORDER.indexOf(monthB);
          });
        }
        setPatches(grouped);
      })
      .catch((e) => {
        console.error("Error loading index.json:", e);
      });
  }, []);

  useEffect(() => {
    if (selected) {
      fetch(baseRawUrl + selected)
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch ${selected}`);
          return res.text();
        })
        .then(setContent)
        .catch((e) => {
          console.error("Error loading patch content:", e);
          setContent("Failed to load content.");
        });
    }
  }, [selected]);

  const toggleYear = (year: string) => {
    setOpenYears((prev) => ({ ...prev, [year]: !prev[year] }));
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-green-400 font-mono p-4">
      <style>{`
          @keyframes typing {
            from { width: 0; }
            to { width: 31ch; } /* Adjust to approx the length of your title */
          }
          @keyframes blink {
            50% { border-color: transparent; }
          }
          .animate-typing {
            overflow: hidden;
            white-space: nowrap;
            border-right: 2px solid #22c55e;
            animation: typing 3s steps(31, end) forwards, blink 0.75s step-end infinite;
            width: 31ch; /* same as animation to keep caret aligned */
            margin: 0 auto 2rem; /* Add bottom margin for spacing */
          }
        `}</style>

      <h1 className="text-4xl mb-6 text-center text-green-300 animate-typing">
        Microsoft Patch Tuesday Stats
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ScrollArea className="h-[80vh] border border-green-600 p-2 rounded-xl shadow-inner bg-[#161b22]">
          {Object.keys(patches)
            .sort((a, b) => parseInt(b) - parseInt(a))
            .map((year) => (
              <div key={year} className="mb-2">
                <Button
                  variant="ghost"
                  className="w-full justify-between text-left hover:bg-green-900"
                  onClick={() => toggleYear(year)}
                >
                  {year}
                  {openYears[year] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                {openYears[year] && (
                  <div className="ml-4 border-l border-green-800 pl-2">
                    {patches[year].map((file) => (
                      <Button
                        key={file}
                        variant="ghost"
                        className="w-full justify-start text-left text-sm hover:bg-green-800"
                        onClick={() => setSelected(file)}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {file.replace(".txt", "")}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </ScrollArea>

        <Card className="md:col-span-3 bg-[#0f172a] text-green-300 border-[1.5px] border-green-500 rounded-xl glow-box">
          <CardContent className="prose prose-invert prose-sm max-w-none p-6 overflow-y-auto h-[80vh] whitespace-pre-wrap">
            {content ? (
              <div>{content.split("\n").map((line, i) => (<p key={i}>{line}</p>))}</div>
            ) : (
              "Select a month from the side panel to view Patch Tuesday details."
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
