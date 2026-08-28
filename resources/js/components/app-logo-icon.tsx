import type { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            {...props}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M8.5 9.5h15M8.5 16h10M8.5 22.5h7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
            />
            <path
                d="M20.5 19.5l3 3 5-6"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <rect
                x="3.75"
                y="3.75"
                width="24.5"
                height="24.5"
                rx="7.25"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.62"
            />
        </svg>
    );
}
