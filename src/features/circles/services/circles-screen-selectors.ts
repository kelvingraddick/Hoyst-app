import type {ExploreCircle} from '../../../types/models';

export function getPublicCircleCategories(
  circles: Pick<ExploreCircle, 'category'>[],
) {
  return [
    'All',
    ...Array.from(new Set(circles.map(circle => circle.category))),
  ];
}

export function getPublicCircleSearchText(
  circle: Pick<ExploreCircle, 'category' | 'commitment' | 'matchCopy' | 'title'>,
) {
  return [
    circle.title,
    circle.category,
    circle.commitment,
    circle.matchCopy,
  ].join(' ');
}

export function filterPublicCircles(
  circles: ExploreCircle[],
  activeCategory: string,
  searchTerm: string,
) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  return circles.filter(circle => {
    const matchesCategory =
      activeCategory === 'All' || circle.category === activeCategory;
    const matchesSearch =
      normalizedSearch.length === 0 ||
      getPublicCircleSearchText(circle).toLowerCase().includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });
}
