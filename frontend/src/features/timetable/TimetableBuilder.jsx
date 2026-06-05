import { useState } from "react";

import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";

import PeriodsPanel from "./PeriodsPanel";
import HolidaysPanel from "./HolidaysPanel";
import GridPanel from "./GridPanel";

import "../../App.css";
import "../../styles/TimetableBuilder.css";

export default function TimetableBuilder() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("periods"); // periods is step 1

  return (
    <div className="app">
      <Navbar setOpen={setOpen} />

      <div className="layout">
        <Sidebar open={open} setOpen={setOpen} />

        <div className="main">
          <div className="tb">
            <header className="tb-head">
              <h1>Timetable Setup</h1>
              <p>Set the daily periods first, then build each class's grid.</p>
            </header>

            <div className="tb-tabs">
              <button
                className={tab === "periods" ? "active" : ""}
                onClick={() => setTab("periods")}
              >
                1 · Periods
              </button>
              <button
                className={tab === "holidays" ? "active" : ""}
                onClick={() => setTab("holidays")}
              >
                2 · Semester &amp; Holidays
              </button>
              <button
                className={tab === "grid" ? "active" : ""}
                onClick={() => setTab("grid")}
              >
                3 · Timetable Builder
              </button>
            </div>

            {tab === "periods" && <PeriodsPanel />}
            {tab === "holidays" && <HolidaysPanel />}
            {tab === "grid" && <GridPanel goToPeriods={() => setTab("periods")} />}
          </div>
        </div>
      </div>
    </div>
  );
}