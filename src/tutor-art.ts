/** Local SVG art. Each lesson has its own animated landmark. */
export function flightScene(down = false, won = false, level = 'move') {
  const line = 'stroke="var(--game-cream)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const scenes: Record<string, string> = {
    move: `<path d="M58 123h94M186 123h70" ${line}/><path d="M48 116h90v10H48z" fill="var(--game-green)" ${line}/><path d="M191 116h84v10h-84z" fill="var(--game-orange)" ${line}/><path d="M126 78q35-39 83 7" fill="none" ${line} stroke-dasharray="4 6"/>`,
    navigate: `<g class="scene-motion scene-navigate"><path d="M190 32h62v82h-62z" fill="none" ${line}/><path d="M201 49h38M201 61h24M201 73h31" ${line}/><text x="215" y="104" fill="var(--scene-gold)" font-size="22" font-weight="800">2</text></g><path d="M53 130h218" ${line}/><path d="M153 120l12 10-12 10" fill="none" ${line}/>` ,
    search: `<g class="scene-motion scene-search"><circle cx="211" cy="68" r="27" fill="none" ${line}/><path d="m232 89 24 24" ${line}/><path d="M196 66h31M196 73h22" stroke="var(--game-green)" stroke-width="3"/></g><path d="M70 127h196" ${line}/>` ,
    preview: `<g class="scene-motion scene-preview"><rect x="174" y="30" width="92" height="75" rx="5" fill="none" ${line}/><path d="M174 46h92" ${line}/><text x="185" y="81" fill="var(--scene-gold)" font-size="21" font-family="serif">E = mc²</text></g><path d="M56 128h218" ${line}/>` ,
    pin: `<g class="scene-motion scene-pin"><path d="M184 35h84v82h-84zM225 35v82" fill="none" ${line}/><path d="m239 51 10 10-6 4-4 13-4-13-6-4z" fill="var(--game-orange)" ${line}/></g><path d="M61 132h207" ${line}/>` ,
    trail: `<path class="scene-motion scene-trail" d="M164 53h89v34h-89m0 0 12-10m-12 10 12 10" fill="none" ${line} stroke-dasharray="7 4"/><circle cx="165" cy="53" r="6" fill="var(--game-green)"/><circle cx="253" cy="87" r="6" fill="var(--game-orange)"/><path d="M55 130h220" ${line}/>` ,
    theme: `<g class="scene-motion scene-theme"><circle cx="219" cy="74" r="37" fill="none" ${line}/><path d="M219 37a37 37 0 0 1 0 74z" fill="var(--scene-gold)"/><circle cx="219" cy="74" r="37" fill="none" ${line}/><path d="M219 23v-9M219 134v-9M168 74h-9M279 74h-9" ${line}/></g><path d="M56 131h80" ${line}/>` ,
    bookmark: `<g class="scene-motion scene-bookmark"><path d="M186 30h65v93l-32-20-33 20z" fill="var(--game-orange)" ${line}/><path d="M199 49h39M199 60h29" ${line}/></g><path d="M53 135h221" ${line}/>` ,
    notes: `<g class="scene-motion scene-notes"><path d="M181 31h81v89h-81zM193 51h54M193 65h54M193 79h35" fill="none" ${line}/><path d="m231 95 25-25 8 8-25 25-12 4z" fill="var(--scene-gold)" ${line}/></g><path d="M60 133h214" ${line}/>` ,
    ruler: `<g class="scene-motion scene-ruler"><rect x="171" y="48" width="99" height="38" rx="4" fill="var(--game-green)" ${line}/><path d="M184 48v14m14-14v8m14-8v14m14-14v8m14-8v14m14-14v8" ${line}/></g><path d="M55 130h219" ${line}/>` ,
    spread: `<g class="scene-motion scene-spread"><path d="M220 45q-21-17-48-7v82q28-9 48 8m0-83q21-17 48-7v82q-28-9-48 8zM220 45v83" fill="none" ${line}/><path d="M182 56h25M182 68h25M233 56h25M233 68h25" ${line}/></g><path d="M51 138h220" ${line}/>` ,
  };
  return `<svg class="flight-scene level-${level} ${down ? 'is-down' : ''} ${won ? 'is-won' : ''}" viewBox="0 0 320 176" aria-hidden="true">
    <path d="M19 26h3v9h-3zM16 29h9v3h-9zM278 30h3v9h-3zM275 33h9v3h-9z" fill="var(--scene-gold)"/>
    ${scenes[level] || scenes.move}
    <g class="flight-bird"><g transform="scale(2.4)" stroke="var(--game-cream)" stroke-width="1" stroke-linejoin="round"><path d="M2 17V9h5V5h6V1h7v3h4v13h-4v5H8v-3H2z" fill="var(--scene-gold)"/><path d="M23 6h6v4h-6" fill="var(--game-orange)"/><path class="flight-wing" d="M4 12h9v5H8v2H4z" fill="var(--game-green)"/><path d="M9 22v3h5m4-3v3h5" fill="none"/><rect x="18" y="5" width="2" height="2" fill="var(--game-cream)"/></g></g>
    <g class="flight-feather" fill="var(--scene-gold)" stroke="var(--game-cream)" stroke-width="2"><path d="m279 139 4-10 7-5 2 9-6 9-7 4z"/><path d="m276 149 11-18"/></g>
    ${won ? '<path d="m145 68 4 10 11 1-8 7 2 11-9-6-10 6 2-11-8-7 11-1z" fill="var(--scene-gold)" stroke="var(--game-cream)" stroke-width="2"/>' : ''}
  </svg>`;
}
