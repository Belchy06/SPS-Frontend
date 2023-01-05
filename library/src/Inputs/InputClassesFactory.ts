import { FakeTouchController } from "./FakeTouchController";
import { KeyboardController } from "./KeyboardController";
import { MouseController } from "./MouseController";
import { TouchController } from "./TouchController";
import { GamePadController } from "./GamepadController";
import { Config, ControlSchemeType } from "../Config/Config";
import { LockedMouseEvents } from "./LockedMouseEvents";
import { HoveringMouseEvents } from "./HoveringMouseEvents";
import { IVideoPlayer } from "../VideoPlayer/IVideoPlayer";
import { IMouseEvents } from "./IMouseEvents";
import { Logger } from "../Logger/Logger";
import { IStreamMessageController } from "../UeInstanceMessage/IStreamMessageController";
import { NormalizeAndQuantize } from "../NormalizeAndQuantize/NormalizeAndQuantize";
import { IPlayerStyleAttributes } from "../Ui/IPlayerStyleAttributes";

/**
 * Class for making and setting up input class types 
 */
export class InputClassesFactory {

    toStreamerMessagesProvider: IStreamMessageController;
    videoElementProvider: IVideoPlayer;
    normalizeAndQuantize: NormalizeAndQuantize;
    activeKeys: IActiveKeys = new ActiveKeys();

    /**
     * @param toStreamerMessagesProvider - Stream message instance  
     * @param videoElementProvider - Video Player instance
     * @param normalizeAndQuantize - A normalize and quantize instance 
     */
    constructor(toStreamerMessagesProvider: IStreamMessageController, videoElementProvider: IVideoPlayer, normalizeAndQuantize: NormalizeAndQuantize) {
        this.toStreamerMessagesProvider = toStreamerMessagesProvider;
        this.videoElementProvider = videoElementProvider;
        this.normalizeAndQuantize = normalizeAndQuantize;
    }

    /**
     * Registers browser key events.
     */
    registerKeyBoard(config: Config) {
        Logger.Log(Logger.GetStackTrace(), "Register Keyboard Events", 7);
        const keyboardController = new KeyboardController(this.toStreamerMessagesProvider, this.activeKeys, config);
        keyboardController.registerKeyBoardEvents();
        return keyboardController;
    }

    /**
     * register mouse events based on a control type 
     * @param controlScheme - if the mouse is either hovering or locked 
     */
    registerMouse(controlScheme: ControlSchemeType, playerStyleAttributesProvider: IPlayerStyleAttributes) {
        Logger.Log(Logger.GetStackTrace(), "Register Mouse Events", 7);
        const mouseController = new MouseController(this.toStreamerMessagesProvider, this.videoElementProvider, this.normalizeAndQuantize);
        mouseController.clearMouseEvents();

        switch (controlScheme) {
            case ControlSchemeType.LockedMouse:
                this.registerLockedMouseEvents(mouseController, playerStyleAttributesProvider);
                break
            case ControlSchemeType.HoveringMouse:
                this.registerHoveringMouseEvents(mouseController);
                break
            default:
                Logger.Info(Logger.GetStackTrace(), "unknown Control Scheme Type Defaulting to Locked Mouse Events");
                this.registerLockedMouseEvents(mouseController, playerStyleAttributesProvider);
                break
        }

        return mouseController;
    }

    /**
     * Register a locked mouse class 
     * @param mouseController - a mouse controller instance 
     * @param playerStyleAttributesProvider - a player style attributes instance
     */
    registerLockedMouseEvents(mouseController: MouseController, playerStyleAttributesProvider: IPlayerStyleAttributes) {
        const videoElementParent = this.videoElementProvider.getVideoParentElement() as HTMLDivElement;
        const lockedMouseEvents: IMouseEvents = new LockedMouseEvents(this.videoElementProvider, mouseController, this.activeKeys, playerStyleAttributesProvider);

        videoElementParent.requestPointerLock = videoElementParent.requestPointerLock || videoElementParent.mozRequestPointerLock;
        document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;

        // minor hack to alleviate ios not supporting pointerlock
        if (videoElementParent.requestPointerLock) {
            videoElementParent.onclick = () => {
                videoElementParent.requestPointerLock();
            };
        }

        const lockStateChangeListener = () => lockedMouseEvents.lockStateChange();
        document.addEventListener('pointerlockchange', lockStateChangeListener, false);
        document.addEventListener('mozpointerlockchange', lockStateChangeListener, false);

        videoElementParent.onmousedown = (mouseEvent: MouseEvent) => lockedMouseEvents.handleMouseDown(mouseEvent);
        videoElementParent.onmouseup = (mouseEvent: MouseEvent) => lockedMouseEvents.handleMouseUp(mouseEvent);
        videoElementParent.onwheel = (wheelEvent: WheelEvent) => lockedMouseEvents.handleMouseWheel(wheelEvent);
        videoElementParent.ondblclick = (mouseEvent: MouseEvent) => lockedMouseEvents.handleMouseDouble(mouseEvent);
        videoElementParent.pressMouseButtons = (mouseEvent: MouseEvent) => lockedMouseEvents.handlePressMouseButtons(mouseEvent);
        videoElementParent.releaseMouseButtons = (mouseEvent: MouseEvent) => lockedMouseEvents.handleReleaseMouseButtons(mouseEvent);

    }

    /**
     * Register a hovering mouse class
     * @param mouseController - A mouse controller object 
     */
    registerHoveringMouseEvents(mouseController: MouseController) {
        const videoElementParent = this.videoElementProvider.getVideoParentElement() as HTMLDivElement;
        const hoveringMouseEvents = new HoveringMouseEvents(mouseController);

        videoElementParent.onmousemove = (mouseEvent: MouseEvent) => hoveringMouseEvents.updateMouseMovePosition(mouseEvent);
        videoElementParent.onmousedown = (mouseEvent: MouseEvent) => hoveringMouseEvents.handleMouseDown(mouseEvent);
        videoElementParent.onmouseup = (mouseEvent: MouseEvent) => hoveringMouseEvents.handleMouseUp(mouseEvent);
        videoElementParent.oncontextmenu = (mouseEvent: MouseEvent) => hoveringMouseEvents.handleContextMenu(mouseEvent);
        videoElementParent.onwheel = (wheelEvent: WheelEvent) => hoveringMouseEvents.handleMouseWheel(wheelEvent);
        videoElementParent.ondblclick = (mouseEvent: MouseEvent) => hoveringMouseEvents.handleMouseDouble(mouseEvent);
        videoElementParent.pressMouseButtons = (mouseEvent: MouseEvent) => hoveringMouseEvents.handlePressMouseButtons(mouseEvent);
        videoElementParent.releaseMouseButtons = (mouseEvent: MouseEvent) => hoveringMouseEvents.handleReleaseMouseButtons(mouseEvent);
    }

    /**
     * register touch events 
     * @param fakeMouseTouch - the faked mouse touch event 
     */
    registerTouch(fakeMouseTouch: boolean, videoElementParentClientRect: DOMRect) {
        Logger.Log(Logger.GetStackTrace(), "Registering Touch", 6);
        if (fakeMouseTouch) {
            const fakeTouchController = new FakeTouchController(this.toStreamerMessagesProvider, this.videoElementProvider, this.normalizeAndQuantize);
            fakeTouchController.setVideoElementParentClientRect(videoElementParentClientRect);
            return fakeTouchController;
        } else {
            return new TouchController(this.toStreamerMessagesProvider, this.videoElementProvider, this.normalizeAndQuantize);
        }
    }

    /**
     * registers a gamepad 
     */
    registerGamePad() {
        Logger.Log(Logger.GetStackTrace(), "Register Game Pad", 7);
        const gamePadController = new GamePadController(this.toStreamerMessagesProvider);
        return gamePadController;
    }
}

/**
 * An interface for the active keys class
 */
export interface IActiveKeys {
    getActiveKeys(): Array<any>;
}

/**
 * A class that keeps track of current active keys
 */
export class ActiveKeys implements IActiveKeys {
    activeKeys: Array<any> = [];
    constructor() {
        this.activeKeys = [];
    }

    /**
     * Get the current array of active keys 
     * @returns - an array of active keys 
     */
    getActiveKeys(): any[] {
        return this.activeKeys;
    }
}

