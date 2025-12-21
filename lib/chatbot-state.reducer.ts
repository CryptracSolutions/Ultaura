import { useReducer } from 'react';

export enum ChatBotActionTypes {
  SET_IS_OPEN = 'SET_IS_OPEN',
  SET_IS_LOADING = 'SET_IS_LOADING',
}

type SetIsOpenAction = {
  type: ChatBotActionTypes.SET_IS_OPEN;
  payload: boolean;
};

type SetIsLoadingAction = {
  type: ChatBotActionTypes.SET_IS_LOADING;
  payload: boolean;
};

type Actions = SetIsOpenAction | SetIsLoadingAction;

const initialState = {
  isOpen: false,
  isLoading: false,
};

type State = typeof initialState;

function reducer(state: State, action: Actions) {
  switch (action.type) {
    case ChatBotActionTypes.SET_IS_OPEN:
      return {
        ...state,
        isOpen: action.payload,
      };

    case ChatBotActionTypes.SET_IS_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };

    default:
      return state;
  }
}

export default function useChatBotState() {
  return useReducer(reducer, initialState);
}
