type NamedRoute = {
  name: string;
};

type AuthModalDismissState<Route extends NamedRoute = NamedRoute> = {
  index: number;
  routes: readonly Route[];
};

const accountRouteNames = new Set(['EditProfile', 'Settings']);

export function getStateWithoutAuthModal<State extends AuthModalDismissState>(
  state: State,
): State | undefined {
  const hasMainTabs = state.routes.some(route => route.name === 'MainTabs');
  const hasAuth = state.routes.some(route => route.name === 'Auth');

  if (!hasMainTabs || !hasAuth) {
    return undefined;
  }

  const routes = state.routes.filter(
    route => route.name !== 'Auth' && !accountRouteNames.has(route.name),
  );

  if (routes.length === state.routes.length || routes.length === 0) {
    return undefined;
  }

  return {
    ...state,
    index: Math.min(state.index, routes.length - 1),
    routes,
  };
}
