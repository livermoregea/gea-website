import s from './geai-brand.module.css';

export default function GeaiBrand({ active = false }: { active?: boolean }) {
  return <span className={s.brand} role="img" aria-label="GEAI summary">
    <svg viewBox="0 0 56 56" width="44" height="44" fill="none" aria-hidden="true" className={`${s.mark} ${active ? s.active : ''}`}>
      <g className={s.pinwheel}>
        <path className={`${s.petal} ${s.northWest}`} d="M26 26c-14 0-19-7-16-14 3-7 13-7 17 0 2 4 2 8-1 14Z" fill="#123524" />
        <path className={`${s.petal} ${s.northEast}`} d="M30 26c0-14 7-19 14-16 7 3 7 13 0 17-4 2-8 2-14-1Z" fill="#C9A227" />
        <path className={`${s.petal} ${s.southEast}`} d="M30 30c14 0 19 7 16 14-3 7-13 7-17 0-2-4-2-8 1-14Z" fill="#123524" />
        <path className={`${s.petal} ${s.southWest}`} d="M26 30c0 14-7 19-14 16-7-3-7-13 0-17 4-2 8-2 14 1Z" fill="#C9A227" />
      </g>
    </svg>
    <span className={s.wordmark}><span>GE<span className={s.ai}>AI</span></span><span className={s.caption}>Summary</span></span>
  </span>;
}
