"use client";

import { famous } from "@/app/resource";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export default function FameWall() {
    const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

    const toggleCard = (index: number) => {
        const newExpanded = new Set(expandedCards);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedCards(newExpanded);
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-center mb-2">冥人唐</h1>
                <p className="text-center text-muted-foreground">展示服内名人</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {famous.map((person, index) => {
                    const isExpanded = expandedCards.has(index);
                    
                    return (
                        <div 
                            key={index}
                            className="bg-card border border-border rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                            {/* 头像区域 */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border flex items-center justify-center">
                                        <img 
                                            src={`https://mc-heads.net/avatar/${person.mcid}/64`}
                                            alt={`${person.name} 的头像`}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                // 如果头像加载失败，显示备用头像
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                                const parent = target.parentElement;
                                                if (parent) {
                                                    parent.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center"><span class="text-white font-bold text-xl">${person.name.charAt(0)}</span></div>`;
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-card-foreground">{person.name}</h3>
                                        <p className="text-sm text-muted-foreground mb-1">{person.mcid}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {person.role}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => toggleCard(index)}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            {/* 标签 */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {person.tags.map((tag, tagIndex) => (
                                    <span 
                                        key={tagIndex}
                                        className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            {/* 描述文本 - 可展开/收起 */}
                            {isExpanded && (
                                <div className="bg-muted rounded-lg p-4 animate-in slide-in-from-top-2 duration-200">
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {person.desc}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}