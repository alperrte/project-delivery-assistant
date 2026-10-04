"use client";

import { useId } from "react";
import { EntityCover } from "@/components/common/entity-cover";

/** Decorative default artwork; selecting an uploaded cover replaces it. */
function DefaultCover() {
 const id = useId();
 return <svg aria-hidden="true" viewBox="0 0 600 150" preserveAspectRatio="xMidYMid slice" className="size-full dark:saturate-200">
  <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--surface-2)"/><stop offset="1" stopColor="var(--label-blue)" stopOpacity=".9"/></linearGradient></defs>
  <rect width="600" height="150" fill={`url(#${id})`}/>
  {[ [42,28],[95,63],[162,21],[221,48],[310,19],[360,62],[454,32],[525,57],[566,17] ].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i%3===0?1.4:.8} fill="var(--foreground)" opacity=".3"/>)}
  <path d="M0 139 Q110 119 240 136 Q400 95 600 134 V150 H0Z" fill="var(--surface-2)" opacity=".75"/>
  <path d="M0 150 Q140 135 290 142 Q430 111 600 139 V150Z" fill="var(--card)"/>
 </svg>;
}
export function OrganizationCover({src,className}:{src:string|null;className?:string}) {
 return <EntityCover src={src} className={className} fallback={<DefaultCover/>}/>;
}
