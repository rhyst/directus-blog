// Modified from https://github.com/ahungrynoob/showdown-toc

export type Options = {
    ordered: boolean;
    tocClass: string;
    maxLevel: number;
}

type TocItem = {
    anchor: string;
    level: number;
    text: string;
};

type MetaInfo =
    | {
        type: 'toc';
    }
    | {
        type: 'header';
        anchor: string;
        level: number;
        text: string;
    };

const defaultOptions: Options = {
    ordered: false,
    tocClass: 'toc',
    maxLevel: 9999,
}

export function showdownToc(optionsPartial: Partial<Options> = {}) {
    return () => [
        {
            type: 'output',
            filter(source: string) {
                const options = {
                    ...defaultOptions,
                    ...optionsPartial
                }

                const regex = /(<h([1-6]).*?id="([^"]*?)".*?>(.+?)<\/h[1-6]>)|(<p>\[toc\]<\/p>)/g;

                // find and collect all headers and [toc] node;
                const collection: MetaInfo[] = [];
                source.replace(regex, (wholeMatch, _, level, anchor, text) => {
                    if (wholeMatch === '<p>[toc]</p>') {
                        collection.push({ type: 'toc' });
                    } else {
                        text = text.replace(/<[^>]+>/g, '');
                        const tocItem = {
                            anchor,
                            level: Number(level),
                            text,
                        };
                        collection.push({
                            type: 'header',
                            ...tocItem,
                        });
                    }
                    return '';
                });

                // calculate toc info
                const tocCollection: TocItem[][] = [];
                collection.forEach(({ type }, index) => {
                    if (type === 'toc') {
                        if (collection[index + 1] && collection[index + 1].type === 'header') {
                            const headers = [];
                            for (let i = index + 1; i < collection.length; i++) {
                                if (collection[i].type === 'toc') break;
                                headers.push(collection[i] as TocItem);
                            }
                            tocCollection.push(headers);
                        } else {
                            tocCollection.push([]);
                        }
                    }
                });

                const btag = options.ordered ? '<ol>' : '<ul>'
                const etag = options.ordered ? '</ol>' : '</ul>'

                // replace [toc] node in source
                source = source.replace(/<p>\[toc\]<\/p>[\n]*/g, () => {
                    const headers = tocCollection.shift();
                    if (headers && headers.length) {
                        const parts = []
                        parts.push(btag.replace('>', ` class="${options.tocClass}">`))
                        const firstLevel = headers[0].level;
                        let lastLevel = headers[0].level;
                        headers.forEach((header) => {
                            if (header.level < options.maxLevel) {
                                parts.push((header.level < lastLevel ? etag : btag).repeat(Math.abs(header.level - lastLevel)))
                                parts.push(`<li><a href="#${header.anchor}">${header.text}</a></li>`)
                                lastLevel = header.level;
                            }
                        })
                        for (let i = 0; i < firstLevel + 1 - lastLevel; i++) {
                            parts.push(etag)
                        }
                        const str = `${parts.join('')}\n`;
                        return str;
                    }
                    return '';
                });

                return source;
            },
        },
    ];
}
